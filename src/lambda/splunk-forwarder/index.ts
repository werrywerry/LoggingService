import * as zlib from "zlib";
import { Context } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { createLogger, getLogger, LogLevel } from 'logging';
import { v4 as uuidv4 } from 'uuid';

const client = new SecretsManagerClient({ region: "ap-southeast-2" });
let logGroupName = "";
export let cachedSecrets: any;
let splunkIndexToken = "";
let logLevel: LogLevel;

export const handler = async (event: any, context: Context) => {

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
      SubcomponentName: 'SplunkForwarder',
      TrackingId: uuidv4(),
      RequestId: context.awsRequestId,
      XrayTraceId: process.env._X_AMZN_TRACE_ID,
      LogLevel: logLevel
    }
  });

  const logs = prepareLogEvents(event);
  logger.debug("Log Inputs", { SupplementaryData: { event, logs: logs, context } });

  if (!cachedSecrets) {
    try {
      cachedSecrets = await getSecret("LoggingService-SplunkIndexToken");
    } catch (error: any) {
      logger.error("Error retrieving Splunk Index Token from Secrets Manager", { SupplementaryData: error });
      throw error;
    }
  }
  if (cachedSecrets) {
    try {
      splunkIndexToken = extractTokenFromSecrets();
    } catch (error: any) {
      logger.error("Unable to determine splunkIndexToken from cachedSecrets", { SupplementaryData: error });
      throw error;
    }
  }

  for (const log of logs) {
    try {
      await sendLogEvent(log);
    } catch (error: any) {
      logger.error("Error sending log to Splunk", { SupplementaryData: error });
    }
  }
};

export function extractTokenFromSecrets() {
  return cachedSecrets.SPLUNK_INDEX_TOKEN;
}

export function prepareLogEvents(event: any) {
  if (!event?.awslogs?.data) {
    return;
  }

  const encLogEvents = Buffer.from(event.awslogs.data, "base64");
  const decLogEvents = zlib.unzipSync(encLogEvents).toString();
  const parsedLogEvent = JSON.parse(decLogEvents);
  const preparedLogEvent = parsedLogEvent.logEvents.map((it: any) => ({
    ...it,
    message: safelyParseJSON(it.message),
  }));
  logGroupName = parsedLogEvent.logGroup.toString();

  return preparedLogEvent;
}

async function sendLogEvent(log: any) {
  const logger = getLogger();
  let metadata;
  let environment;
  // If structured log, extract metadata
  if (log.message.Header) {
    metadata = {
      ComponentName: log.message.Header.ComponentName,
      CreationTime: log.message.Header.CreationTime,
      Environment: log.message.Header.Environment,
      SystemName: log.message.Header.SystemName,
      TrackingId: log.message.Header.TrackingId,
      XrayTraceId: log.message.Header.XrayTraceId,
    }

    environment = log.message.Header.Environment;
  } else {
    environment = process.env.ENV;  }

  let level;
  if (log.message.level) {
    level = log.message.level
  }

  if (metadata?.CreationTime) {
    log.timestamp = metadata?.CreationTime;
  } else {
    log.timestamp = new Date(log.timestamp).toISOString();
  }

  const request = {
    method: "POST",
    headers: {
      Authorization: "Splunk " + splunkIndexToken,
      'X-Splunk-Request-Channel': process.env.SPLUNK_REQUEST_CHANNEL,
      Accept: "application/json",
      "Content-Type": "application/json",
    } as any,
    body: JSON.stringify({
      sourcetype: "CloudWatch Log Group",
      event: log,
      fields: {
        Environment: environment,
        LogGroup: logGroupName,
        ComponentName: metadata?.ComponentName,
        CreationTime: metadata?.CreationTime,
        SystemName: metadata?.SystemName,
        TrackingId: metadata?.TrackingId,
        XrayTraceId: metadata?.XrayTraceId,
        Level: level
      }
    }),
  };

  try {
    const response = await fetch(process.env.SPLUNK_URL!, request);
    logger.info("Splunk result", { SupplementaryData: { body: await response.text(), status: response.status } });
  } catch (error: any) {
    logger.error("Error sending log to Splunk", { SupplementaryData: error });
    throw error;
  }
}

export async function getSecret(secretName: string): Promise<any> {
  const logger = getLogger();
  const command = new GetSecretValueCommand({ SecretId: secretName });
  try {
    const data = await client.send(command);
    if ('SecretString' in data && data.SecretString) {
      return JSON.parse(data.SecretString);
    }
    throw new Error("Secret binary not supported or missing SecretString");
  } catch (error: any) {
    logger.error("Error retrieving secret", { SupplementaryData: error });
    throw error;
  }
}

export function safelyParseJSON(json: string) {
  try {
    return JSON.parse(json);
  } catch (error) {
    return json;
  }
}
