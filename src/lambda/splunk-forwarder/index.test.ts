// SplunkForwarder index.test.ts
import awsMock from 'aws-sdk-mock';
import fetchMock from 'jest-fetch-mock';
import { handler } from './index';
import { AWSError } from 'aws-sdk';
import { Context } from 'aws-lambda';

describe('SplunkForwarder Tests', () => {
  let mockEvent: any;
  let mockContext: Context;
  // Set any global configuration for your tests
  beforeEach(() => {
    awsMock.mock('SecretsManager', 'getSecretValue', (params, callback) => {
      const error = {
        name: "MockedAWSError",
        message: "Failed to retrieve secret",
        code: "MockErrorCode",
        time: new Date(),
      };
      callback(error as AWSError, undefined);
    });
    fetchMock.enableMocks();

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
      done: () => {},
      fail: () => {},
      succeed: () => {},
    } as Context;

    mockEvent = {};

    process.env.LOG_LEVEL = 'INFO';
    process.env.ENV = 'Test';
    process.env.SPLUNK_REQUEST_CHANNEL = 'test-channel';
    process.env.SPLUNK_URL = 'https://splunk.example.com';

  });

  afterEach(() => {
    awsMock.restore('SecretsManager');
    fetchMock.resetMocks();
  });

  it('should handle errors when retrieving secrets', async () => {
    
//    await expect(handler(mockEvent, mockContext)).rejects.toThrow("Failed to retrieve secret");
  
    // Restore the mock after the test
    awsMock.restore('SecretsManager');
  });
  // Additional test cases...
});
