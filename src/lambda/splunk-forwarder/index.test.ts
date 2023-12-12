// SplunkForwarder index.test.ts
import fetchMock from 'jest-fetch-mock';
import { handler } from './index';
import { Context } from 'aws-lambda';
import * as zlib from "zlib";
import { createLogger, getLogger, LogLevel } from 'logging';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

jest.mock('logging', () => {
  // Mock LogLevel if used in your tests
  const MockedLogLevel = {
    INFO: 'info',
    DEBUG: 'debug',
    WARN: 'warn',
    ERROR: 'error',
    // Add other levels if used
  };

  // Mock logger object
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    // Add other methods if used
  };

  return {
    LogLevel: MockedLogLevel,
    createLogger: jest.fn(() => mockLogger),
    getLogger: jest.fn(() => mockLogger),
  };
});

fetchMock.enableMocks();

const exampleLogEvent = {
  messageType: 'DATA_MESSAGE',
  owner: '123456789012',
  logGroup: '/aws/lambda/exampleLambdaFunction',
  logStream: '2019/11/26/[$LATEST]exampleLogStream',
  subscriptionFilters: ['exampleFilter'],
  logEvents: [
    {
      id: 'eventId1',
      timestamp: 1574782020000,
      message: '[ERROR] First test message'
    },
    {
      id: 'eventId2',
      timestamp: 1574782020001,
      message: '[INFO] Second test message'
    }
    // ... additional log events ...
  ]
};

// Convert the event object to a JSON string
const jsonLogEvent = JSON.stringify(exampleLogEvent);

// Compress using gzip
const compressedLogEvent = zlib.gzipSync(Buffer.from(jsonLogEvent));

// Convert to base64
const base64EncodedLogEvent = compressedLogEvent.toString('base64');

// This is your mock CloudWatch Logs event
const mockCloudWatchEvent = {
  awslogs: {
    data: base64EncodedLogEvent
  }
};

describe('SplunkForwarder Tests', () => {
  let mockEvent: any;
  let mockContext: Context;
  // Set any global configuration for your tests
  beforeEach(() => {
    //fetchMock.resetMocks();
    fetchMock.doMock();

    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'mockFunction',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:mockFunction',
      memoryLimitInMB: '128',
      awsRequestId: '12345678-1234-1234-1234-123456789012',
      logGroupName: '/aws/lambda/mockFunction',
      logStreamName: '2019/05/27/[$LATEST]8e8f49e4d6b94516a253',
      getRemainingTimeInMillis: () => 5000,
      done: () => { },
      fail: () => { },
      succeed: () => { },
    } as Context;

    process.env.LOG_LEVEL = 'INFO';
    process.env.ENV = 'Test';
    process.env.SPLUNK_REQUEST_CHANNEL = 'test-channel';
    process.env.SPLUNK_URL = 'https://splunk.example.com';
  });

  afterEach(() => {
    fetchMock.resetMocks();
    //jest.resetAllMocks();
  });

  it('should log an error and throw when failing to retrieve Splunk Index Token', async () => {
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest.fn().mockRejectedValue(new Error('Failed to retrieve secret'));
    SecretsManagerClient.prototype.send = mockSend;

    // Setup mock event data with CloudWatch logs
    mockEvent = {
      awslogs: {
        data: mockCloudWatchEvent.awslogs.data,
      }
    };

    // Call the handler with the mock event and context and expect an error
    await expect(handler(mockEvent, mockContext)).rejects.toThrow('Failed to retrieve secret');

    // Assertions
    const logger = getLogger();
    expect(logger.error).toHaveBeenCalledWith("Error retrieving Splunk Index Token from Secrets Manager", expect.anything());
  });

  it('should retrieve Splunk Index Token and process logs', async () => {

    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest.fn().mockResolvedValueOnce({
      SecretString: JSON.stringify({ SPLUNK_INDEX_TOKEN: 'mock-token' })
    });
    SecretsManagerClient.prototype.send = mockSend;

    // Setup mock event data with CloudWatch logs
    mockEvent = {
      awslogs: {
        data: mockCloudWatchEvent.awslogs.data,
      }
    };

    // Setup mock response for fetch to simulate successful log sending
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 });

    // Call the handler with the mock event and context
    const result = await handler(mockEvent, mockContext);

    // Assertions
    const logger = getLogger();
    //expect(result).toBeDefined();
    expect(fetchMock).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Splunk result", expect.anything());
  });

});
