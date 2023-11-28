provider "aws" {
  region = var.region
}

######## Splunk Forwarder Resources ########
data "archive_file" "splunk_forwarder_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../../../../src/lambda/splunk-forwarder/dist/"
  output_path = "${path.module}/../../../../../src/lambda/splunk-forwarder/package.zip"
}

resource "aws_lambda_function" "splunk_forwarder" {
  function_name    = "LoggingService-SplunkForwarder-${var.env}"
  filename         = data.archive_file.splunk_forwarder_package.output_path
  source_code_hash = data.archive_file.splunk_forwarder_package.output_base64sha256
  handler          = "index.handler" # The function entrypoint in your code.
  runtime          = "nodejs18.x"    # Runtime environment for the Lambda function.

  reserved_concurrent_executions = 10

  timeout = 30                                          # Timeout for the Lambda function in seconds.
  role    = aws_iam_role.splunk_forwarder_exec_role.arn # IAM role that the Lambda function assumes.
  tags    = var.tags
  environment {
    variables = {
      SPLUNK_URL             = "https://http-inputs-nswdoe.splunkcloud.com/services/collector/event"
      SPLUNK_REQUEST_CHANNEL = "c4e8ad02-9b5d-451c-b60e-829ce060d412"
      ENV : var.env
    }
  }
}

resource "aws_iam_role" "splunk_forwarder_exec_role" {
  name = "LoggingService-SplunkForwarder-${var.env}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
      },
    ],
  })
}

resource "aws_lambda_permission" "splunk_forwarder_allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.splunk_forwarder.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:*"
}

resource "aws_iam_policy" "splunk_forwarder_exec_policy" {
  name        = "LoggingService-SplunkForwarder-${var.env}-policy"
  description = "IAM policy for Lambda function LoggingService-SplunkForwarder-${var.env}"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Action" : [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Effect" : "Allow",
        "Resource" : [
          "arn:aws:logs:*:*:*"
        ],
        "Sid" : "allowLogging"
      },
      {
        "Effect" : "Allow",
        "Action" : "secretsmanager:GetSecretValue",
        "Resource" : "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:LoggingService-SplunkIndexToken-*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "splunk_forwarder_exec_policy_attachment" {
  role       = aws_iam_role.splunk_forwarder_exec_role.name
  policy_arn = aws_iam_policy.splunk_forwarder_exec_policy.arn
}

######## Subscription Filter Handler Resources ########
# Lambda package
data "archive_file" "subscription_filter_handler_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../../../../src/lambda/subscription-filter-handler/dist/"
  output_path = "${path.module}/../../../../../src/lambda/subscription-filter-handler/package.zip"
}

# Lambda function
resource "aws_lambda_function" "subscription_filter_handler" {
  function_name = "LoggingService-SubscriptionFilterHandler-${var.env}"

  filename         = data.archive_file.subscription_filter_handler_package.output_path
  source_code_hash = data.archive_file.subscription_filter_handler_package.output_base64sha256

  handler = "index.handler" # The function entrypoint in your code.
  runtime = "nodejs18.x"    # Runtime environment for the Lambda function.

  timeout                        = 900
  reserved_concurrent_executions = 1

  role = aws_iam_role.subscription_filter_exec_role.arn # IAM role that the Lambda function assumes.

  environment {
    variables = {
      ENV : var.env,
      REMOVE_SUBSCRIPTIONS : "true",
      SPLUNK_FORWARDER_ARN : aws_lambda_function.splunk_forwarder.arn
    }
  }
  tags = var.tags
}

# Lambda IAM role
resource "aws_iam_role" "subscription_filter_exec_role" {
  name = "LoggingService-SubscriptionFilterHandler-${var.env}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
      },
    ],
  })
}

# Lambda IAM policy
resource "aws_iam_policy" "subscription_filter_exec_policy" {
  name        = "LoggingService-SubscriptionFilterHandler-${var.env}-policy"
  description = "IAM policy for Lambda function LoggingService-SubscriptionFilterHandler-${var.env}"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "logs:CreateLogGroup",
        Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",           // Permission to describe log groups
          "logs:DescribeSubscriptionFilters", // Permission to describe log group subscriptions
          "logs:PutSubscriptionFilter",       // Permission to put log group subscriptions
          "logs:DeleteSubscriptionFilter"
        ],
        Resource = ["*"]
      },
    ],
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "subscription_filter_exec_policy_attachment" {
  role       = aws_iam_role.subscription_filter_exec_role.name
  policy_arn = aws_iam_policy.subscription_filter_exec_policy.arn
}

# LogGroupCreated event rule
resource "aws_cloudwatch_event_rule" "new_log_group_created" {
  name        = "LoggingService-NewLogGroupCreated-${var.env}"
  description = "Sends an event to LoggingService-SubscriptionFilterHandler lambda on log group creation"

  event_pattern = jsonencode({
    "source" : ["aws.logs"],
    "detail-type" : ["AWS API Call via CloudTrail"],
    "detail" : {
      "eventSource" : ["logs.amazonaws.com"],
      "eventName" : ["CreateLogGroup"]
    }
  })

  event_bus_name = "default"
  is_enabled     = true
}

# LogGroupCreated event target
resource "aws_cloudwatch_event_target" "new_log_group_target" {
  rule      = aws_cloudwatch_event_rule.new_log_group_created.name
  target_id = "SubscriptionFilterHandlerLambda" # This can be any unique string.
  arn       = aws_lambda_function.subscription_filter_handler.arn
}

# Lambda permission to allow being triggered by event rule
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subscription_filter_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.new_log_group_created.arn
}

data "aws_caller_identity" "current" {}
