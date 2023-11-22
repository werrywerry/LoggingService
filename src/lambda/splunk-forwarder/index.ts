import * as zlib from "zlib";

let logGroupName = "";

export const handler = async (event: any, context: any) => {
  const logs = prepareLogEvents(event);
  console.log("Input: %j", { event, logs: prepareLogEvents(event), context });

  for (const log of logs) {
    let metadata;
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
        Authorization: "Splunk " + process.env.SPLUNK_INDEX_TOKEN,
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
          //Environment: metadata?.Environment,
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
};

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

function safelyParseJSON(json: string) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return json;
  }
}
