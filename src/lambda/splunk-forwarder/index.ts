import * as zlib from "zlib";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "ap-southeast-2" });
let logGroupName = "";
let cachedSecrets: any;
let splunkIndexToken = "";

export const handler = async (event: any, context: any) => {
  const logs = prepareLogEvents(event);
  console.log("Input: %j", { event, logs: logs, context });

  if (!cachedSecrets) {
    try {
      cachedSecrets = await getSecret("LoggingService-SplunkIndexToken");
    } catch (err) {
      console.error("Error retrieving Splunk Index Token from Secrets Manager", err);
      throw err;
    }
  }
  if (cachedSecrets) {
    try {
      splunkIndexToken = extractTokenFromSecrets();
    } catch (err) {
      console.error(`Unable to determine splunkIndexToken from cachedSecrets. Values are: ${cachedSecrets}`, err)
    }
  } else {
    throw new Error("cachedSecrets variable not found");
  }

  for (const log of logs) {
    try {
      await sendLogEvent(log);
    } catch (error) {
      console.error(error);
    }
  }
};

function extractTokenFromSecrets() {
  return cachedSecrets.SPLUNK_INDEX_TOKEN;
}

function prepareLogEvents(event: any) {
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
  let metadata;
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
  }

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
        Environment: process.env.ENV,
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
    console.log("Splunk result: %j", { body: await response.text(), status: response.status });
  } catch (e) {
    console.error("Error sending log to Splunk: %j", { log, e });
  }
}

async function getSecret(secretName: string): Promise<any> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  try {
    const data = await client.send(command);
    if ('SecretString' in data && data.SecretString) {
      return JSON.parse(data.SecretString);
    }
    throw new Error("Secret binary not supported or missing SecretString");
  } catch (err) {
    console.error("Error retrieving secret:", err);
    throw err;
  }
}

function safelyParseJSON(json: string) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return json;
  }
}
