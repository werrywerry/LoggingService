import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeSubscriptionFiltersCommand,
  PutSubscriptionFilterCommand,
  DeleteSubscriptionFilterCommand
} from "@aws-sdk/client-cloudwatch-logs";
import { createLogger, getLogger, LogLevel } from 'logging';
import { Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const logsClient = new CloudWatchLogsClient({ region: "ap-southeast-2" });
const subscriptionFiltersFailed: string[] = [];
const subscriptionFiltersAdded: string[] = [];
const subscriptionFiltersRemoved: string[] = [];
const filterName = `LogsForSplunkForwarderLambda-${process.env.ENV}`;
let MAX_RETRIES: number;
let retryCount: number;
let errorState: boolean;
let warnState: boolean;
let logLevel: LogLevel;

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

export const handler = async (event: CloudTrailEvent, context: Context) => {
  MAX_RETRIES = 15; // Adjust as needed
  retryCount = 0;
  errorState = false;
  warnState = false;

  if (!process.env.LOG_LEVEL) {
    if (process.env.ENV === "Prod") {
      logLevel = LogLevel.ERROR
    } else {
      logLevel = LogLevel.INFO
    }
  } else {
    logLevel = process.env.LOG_LEVEL as LogLevel
  }

  const logger = createLogger({
    Header: {
      Environment: process.env.ENV,
      SystemName: 'LoggingService',
      ComponentName: 'SplunkLogForwarder',
      SubcomponentName: 'SubscriptionFilterHandler',
      TrackingId: uuidv4(),
      RequestId: context.awsRequestId,
      XrayTraceId: process.env._X_AMZN_TRACE_ID,
      LogLevel: logLevel
    }
  });

  try {
    await processExistingLogGroups();
  } catch (error: any) {
    logger.error("An error occurred", { SupplementaryData: error });
    errorState = true;
  }

  logger.info("These operations were performed", {
    SupplementaryData: {
      SubscriptionFiltersAdded: subscriptionFiltersAdded.length,
      SubscriptionFiltersRemoved: subscriptionFiltersRemoved.length,
      SubscriptionFiltersFailed: subscriptionFiltersFailed.length
    }
  });

  logger.debug("These specific operations were performed", {
    SupplementaryData: {
      SubscriptionFiltersAdded: subscriptionFiltersAdded,
      SubscriptionFiltersRemoved: subscriptionFiltersRemoved,
      SubscriptionFiltersFailed: subscriptionFiltersFailed
    }
  });

  if (errorState) {
    return { status: 'Complete with errors. Check logs' };
  } else if (warnState) {
    return { status: 'Complete with warnings. Check logs' };
  } else {
    return { status: 'Success' };
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
  const logger = getLogger();
  try {
    const desiredDestinationArn = process.env.SPLUNK_FORWARDER_ARN!;
    const describeSubscriptionFiltersCommand = new DescribeSubscriptionFiltersCommand({
      logGroupName: logGroupName
    });
    const filtersResponse = await logsClient.send(describeSubscriptionFiltersCommand);
    const subscriptionFilters = filtersResponse.subscriptionFilters || [];

    const existingFilterWithDesiredArn = subscriptionFilters.find(filter => filter.destinationArn === desiredDestinationArn);

    if (existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "true") {
      await removeSubscriptionFilter(logGroupName);
      subscriptionFiltersRemoved.push(logGroupName);
    }
    else if (!existingFilterWithDesiredArn && process.env.REMOVE_SUBSCRIPTIONS === "false") {
      if (subscriptionFilters.length < 2) {
        await createSubscriptionFilter(logGroupName, desiredDestinationArn);
        subscriptionFiltersAdded.push(logGroupName);
      } else {
        logger.warn(`Error: Log group ${logGroupName} already has two subscription filters. One filter needs to be removed to add the Splunk forwarder filter.`);
        subscriptionFiltersFailed.push(logGroupName);
        warnState = true;
      }
    }
  } catch (error: any) {
    const typedError = error as Error;
    retryCount++;
    if (typedError.name === 'ThrottlingException' && retryCount < MAX_RETRIES) {
      logger.info(`ThrottlingException encountered. Retrying... (Retry count: ${retryCount}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
      return ensureSubscriptionFilter(logGroupName);
    } else {
      logger.error("An error occured", { SupplementaryData: error });
      errorState = true;
      subscriptionFiltersFailed.push(logGroupName);
    }
  }
}

async function createSubscriptionFilter(logGroupName: string, desiredDestinationArn: string) {
  const logger = getLogger();
  try {
    const putSubscriptionFilterCommand = new PutSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: filterName,
      filterPattern: '',
      destinationArn: desiredDestinationArn,
    });
    await logsClient.send(putSubscriptionFilterCommand);
  } catch (error: any) {
    logger.error(`Error creating subscription filter for log group '${logGroupName}'`, { SupplementaryData: error });
    subscriptionFiltersFailed.push(logGroupName);
    errorState = true;
    throw error;
  }
}

async function removeSubscriptionFilter(logGroupName: string) {
  const logger = getLogger();
  try {
    const deleteSubscriptionFilterCommand = new DeleteSubscriptionFilterCommand({
      logGroupName: logGroupName,
      filterName: filterName,
    });

    await logsClient.send(deleteSubscriptionFilterCommand);
  } catch (error: any) {
    logger.error(`Error removing subscription filter from log group '${logGroupName}'`, { SupplementaryData: error });
    errorState = true;
    throw error;
  }
}
