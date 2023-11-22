import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeSubscriptionFiltersCommand,
  PutSubscriptionFilterCommand,
  DeleteSubscriptionFilterCommand
} from "@aws-sdk/client-cloudwatch-logs";

const logsClient = new CloudWatchLogsClient({ region: "ap-southeast-2" });
const logGroupsWithFilters: string[] = [];
const subscriptionsToAdd: string[] = [];
const subscriptionsToRemove: string[] = [];

interface CloudTrailEventDetail {
  eventName: string;
  requestParameters: {
    logGroupName: string;
  };
}

interface CloudTrailEvent {
  'detail-type': string;
  detail: CloudTrailEventDetail;
}

export const handler = async (event: CloudTrailEvent) => {
  try {
    await processExistingLogGroups();
    return { status: 'Success' };
  } catch (error) {
    console.error(error);
    throw new Error('Error creating subscription filters');
  }
};

async function processExistingLogGroups() {
  let nextToken: string | undefined;
  const logGroupNames: string[] = [];

  do {
    const describeLogGroupsCommand = new DescribeLogGroupsCommand({
      nextToken: nextToken,
    });
    const logGroupsResponse = await logsClient.send(describeLogGroupsCommand);

    // Add log group names to the array
    logGroupsResponse.logGroups?.forEach((logGroup) => {
      if (logGroup.logGroupName
        && logGroup.logGroupName.startsWith("/aws/lambda/")
        && !logGroup.logGroupName.includes("LoggingService-SplunkForwarder")) {
        logGroupNames.push(logGroup.logGroupName);
      }
    });

    // Set the nextToken for the next iteration
    nextToken = logGroupsResponse.nextToken;
  } while (nextToken);

  // Log the array of log group names
  // console.log("Number of log groups found: ", logGroupNames.length);
  // console.log("Log groups to check subscriptions for: ", logGroupNames);

  for (const logGroupName of logGroupNames) {
    await ensureSubscriptionFilter(logGroupName);
  }

  console.log("Log groups with existing subscription filters: ", logGroupsWithFilters);
  console.log(`Attempted to add subscription filters to ${subscriptionsToAdd.length} log groups`);
  console.log(`Attempted to remove subscription filters from ${subscriptionsToRemove.length} log groups`);

}

var retryCount = 0;
const MAX_RETRIES = 10; // Adjust as needed

async function ensureSubscriptionFilter(logGroupName: string) {
  try {
    const desiredDestinationArn = `arn:aws:lambda:ap-southeast-2:318468042250:function:LoggingService-SplunkForwarder-${process.env.ENV}`;
    const describeSubscriptionFiltersCommand = new DescribeSubscriptionFiltersCommand({
      logGroupName: logGroupName
    });
    const filtersResponse = await logsClient.send(describeSubscriptionFiltersCommand);
    const subscriptionFilters = filtersResponse.subscriptionFilters || [];

    const existingFilterWithDesiredArn = subscriptionFilters.find(filter => filter.destinationArn === desiredDestinationArn);

    if (existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "true") {
      //subscriptionsToRemove.push(logGroupName);
      await removeSubscriptionFilter(logGroupName, desiredDestinationArn);
    }
    else if (!existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "false") {
      if (subscriptionFilters.length < 2) {
        /*
        if (subscriptionFilters.length > 0) {
          logGroupsWithFilters.push(logGroupName);
        }
        subscriptionsToAdd.push(logGroupName);
        */
        await createSubscriptionFilter(logGroupName, desiredDestinationArn);
      } else {
        console.error(`Error: Log group ${logGroupName} already has two subscription filters. One filter needs to be removed to add the Splunk forwarder filter.`);
      }
    }
  } catch (error) {
    const typedError = error as Error;
    retryCount++;
    if (typedError.name === 'ThrottlingException' && retryCount < MAX_RETRIES) {
      console.log(`ThrottlingException encountered. Retrying... (Retry count: ${retryCount}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
      return ensureSubscriptionFilter(logGroupName);
    } else {
      throw typedError;
    }
  }
}

async function createSubscriptionFilter(logGroupName: string, desiredDestinationArn: string) {
  try {
    const putSubscriptionFilterCommand = new PutSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: `LogsForSplunkForwarderLambda-${process.env.ENV}`,
      filterPattern: '', // You can specify a filter pattern here
      destinationArn: desiredDestinationArn,
    });
    await logsClient.send(putSubscriptionFilterCommand);
    // console.log(`Subscription filter created for log group '${logGroupName}'`);
  } catch (error) {
    console.error(`Error creating subscription filter for log group '${logGroupName}':`, error);
    // throw error;
  }
}

async function removeSubscriptionFilter(logGroupName: string, filterName: string) {
  try {
    const deleteSubscriptionFilterCommand = new DeleteSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: filterName,
    });

    await logsClient.send(deleteSubscriptionFilterCommand);
    // console.log(`Subscription filter '${filterName}' removed from log group '${logGroupName}'`);
  } catch (error) {
    console.error(`Error removing subscription filter from log group '${logGroupName}':`, error);
    // throw error;
  }
}
