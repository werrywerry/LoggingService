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
const filterName = `LogsForSplunkForwarderLambda-${process.env.ENV}`;
var MAX_RETRIES: number;
var retryCount: number;
var errorState: boolean;

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
  MAX_RETRIES = 15; // Adjust as needed
  retryCount = 0;
  errorState = false;

  try {
    await processExistingLogGroups();
    if (errorState) {
      return { status: 'Complete with errors. Check logs' }
    } else {
      return { status: 'Success' };
    }
  } catch (error) {
    console.error(error);
    errorState = true;
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

  for (const logGroupName of logGroupNames) {
    await ensureSubscriptionFilter(logGroupName);
  }
}

async function ensureSubscriptionFilter(logGroupName: string) {
  try {
    const desiredDestinationArn = process.env.SPLUNK_FORWARDER_ARN!;
    const describeSubscriptionFiltersCommand = new DescribeSubscriptionFiltersCommand({
      logGroupName: logGroupName
    });
    const filtersResponse = await logsClient.send(describeSubscriptionFiltersCommand);
    const subscriptionFilters = filtersResponse.subscriptionFilters || [];

    const existingFilterWithDesiredArn = subscriptionFilters.find(filter => filter.destinationArn === desiredDestinationArn);

    if (existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "true") {
      subscriptionsToRemove.push(logGroupName);
      await removeSubscriptionFilter(logGroupName);
    }
    else if (!existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "false") {
      if (subscriptionFilters.length < 2) {

        if (subscriptionFilters.length > 0) {
          logGroupsWithFilters.push(logGroupName);
        }
        subscriptionsToAdd.push(logGroupName);

        await createSubscriptionFilter(logGroupName, desiredDestinationArn);
      } else {
        console.warn(`Error: Log group ${logGroupName} already has two subscription filters. One filter needs to be removed to add the Splunk forwarder filter.`);
        errorState = true;
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
      console.log(error);
      errorState = true;
    }
  }
}

async function createSubscriptionFilter(logGroupName: string, desiredDestinationArn: string) {
  try {
    const putSubscriptionFilterCommand = new PutSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: filterName,
      filterPattern: '',
      destinationArn: desiredDestinationArn,
    });
    await logsClient.send(putSubscriptionFilterCommand);
  } catch (error) {
    console.error(`Error creating subscription filter for log group '${logGroupName}':`, error);
    errorState = true;
  }
}

async function removeSubscriptionFilter(logGroupName: string) {
  try {
    const deleteSubscriptionFilterCommand = new DeleteSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: filterName,
    });

    await logsClient.send(deleteSubscriptionFilterCommand);
  } catch (error) {
    console.error(`Error removing subscription filter from log group '${logGroupName}':`, error);
    errorState = true;
  }
}
