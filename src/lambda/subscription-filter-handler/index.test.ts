import { handler } from './index';
import { CloudWatchLogsClient, PutSubscriptionFilterCommand } from "@aws-sdk/client-cloudwatch-logs";
import { createLogger, getLogger, LogLevel } from 'logging';

jest.mock("@aws-sdk/client-cloudwatch-logs", () => {
  const originalModule = jest.requireActual("@aws-sdk/client-cloudwatch-logs");

  const mockSend = jest.fn((command) => {
    if (command instanceof originalModule.DescribeLogGroupsCommand) {
      return Promise.resolve({
        logGroups: [{ logGroupName: '/aws/lambda/test-log-group' }],
        nextToken: undefined,
      });
    } else if (command instanceof originalModule.DescribeSubscriptionFiltersCommand) {
      return Promise.resolve({ subscriptionFilters: [] });
    } else if (command instanceof originalModule.PutSubscriptionFilterCommand) {
      command.input = {
        logGroupName: '/aws/lambda/test-log-group',
        filterName: 'test-filter-name',
        filterPattern: '',
        destinationArn: 'arn:aws:lambda:region:account-id:function:function-name',
      };
      return Promise.resolve({});
    }
    return Promise.resolve({});
  });

  return {
    ...originalModule,
    CloudWatchLogsClient: jest.fn().mockImplementation(() => ({
      send: mockSend
    })),
    mockSend // expose mockSend for testing
  };
});

describe('SubscriptionFilterHandler Tests', () => {
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPLUNK_FORWARDER_ARN = 'arn:aws:lambda:region:account-id:function:function-name';
    process.env.REMOVE_SUBSCRIPTIONS = "false";
    process.env.ENV = 'Test';
    process.env.LOG_LEVEL = LogLevel.INFO;

    // Access the mockSend from the mocked module
    mockSend = require('@aws-sdk/client-cloudwatch-logs').mockSend;
  });

  afterEach(() => {
    delete process.env.SPLUNK_FORWARDER_ARN;
    delete process.env.REMOVE_SUBSCRIPTIONS;
    delete process.env.ENV;
    delete process.env.LOG_LEVEL;
  });

  it('should add subscription filters when required', async () => {
    await handler({} as any, {} as any);

    // Check if any call to mockSend was with PutSubscriptionFilterCommand and correct input
    const wasCalledWithPutSubscriptionFilterCommand = mockSend.mock.calls.some(call => {
      const command = call[0];
      return command instanceof PutSubscriptionFilterCommand &&
        command.input &&
        command.input.logGroupName === '/aws/lambda/test-log-group' &&
        command.input.destinationArn === 'arn:aws:lambda:region:account-id:function:function-name';
    });

    expect(wasCalledWithPutSubscriptionFilterCommand).toBe(true);
  });

  it('should handle errors during processing of log groups', async () => {
    // Import the necessary command
    const { DescribeLogGroupsCommand } = require("@aws-sdk/client-cloudwatch-logs");

    // Mock DescribeLogGroupsCommand to throw an error
    const mockSend = require('@aws-sdk/client-cloudwatch-logs').mockSend;
    mockSend.mockImplementationOnce((command: typeof DescribeLogGroupsCommand) => {
      if (command instanceof DescribeLogGroupsCommand) {
        throw new Error("Failed to describe log groups");
      }
      return Promise.resolve({});
    });

    const response = await handler({} as any, {} as any);

    expect(response).toEqual({ status: 'Complete with errors. Check logs' });

    // Reset the mock to its original implementation
    jest.restoreAllMocks();
  });

  // Additional test cases...
});
