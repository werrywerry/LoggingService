provider "aws" {
  region = var.region
}

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

  timeout = 120

  role = aws_iam_role.lambda_exec_role.arn # IAM role that the Lambda function assumes.

  environment {
    variables = {
      ENV: var.env,
      REMOVE_SUBSCRIPTIONS: "false"
    }
  }
}

# Lambda IAM role
resource "aws_iam_role" "lambda_exec_role" {
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

  tags = {
    Environment = var.env
  }
}

# Lambda IAM policy
resource "aws_iam_policy" "lambda_exec_policy" {
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
          "logs:DescribeLogGroups", // Permission to describe log groups
          "logs:DescribeSubscriptionFilters", // Permission to describe log group subscriptions
          "logs:PutSubscriptionFilter" // Permission to put log group subscriptions
        ],
        Resource = ["*"]
      },
    ],
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "lambda_exec_policy_attachment" {
  role      = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_exec_policy.arn
}

# LogGroupCreated event rule
resource "aws_cloudwatch_event_rule" "new_log_group_created" {
  name        = "LoggingService-NewLogGroupCreated-${var.env}"
  description = "Sends an event to LoggingService-SubscriptionFilterHandler lambda on log group creation"

  event_pattern = jsonencode({
    "source": ["aws.logs"],
    "detail-type": ["AWS API Call via CloudTrail"],
    "detail": {
      "eventSource": ["logs.amazonaws.com"],
      "eventName": ["CreateLogGroup"]
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
