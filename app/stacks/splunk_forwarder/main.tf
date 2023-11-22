provider "aws" {
  region = var.region
}

data "archive_file" "splunk_forwarder_package" {
  type        = "zip"
  source_dir  = "${path.module}/../../../../../src/lambda/splunk-forwarder/dist/"
  output_path = "${path.module}/../../../../../src/lambda/splunk-forwarder/package.zip"
}

resource "aws_lambda_function" "splunk_forwarder" {
  function_name = "LoggingService-SplunkForwarder-${var.env}"

  filename         = data.archive_file.splunk_forwarder_package.output_path
  source_code_hash = data.archive_file.splunk_forwarder_package.output_base64sha256

  handler = "index.handler" # The function entrypoint in your code.
  runtime = "nodejs18.x"    # Runtime environment for the Lambda function.
  
  timeout = 30 # Timeout for the Lambda function in seconds.

  role = aws_iam_role.lambda_exec_role.arn # IAM role that the Lambda function assumes.

  environment {
    variables = {
      SPLUNK_URL             = "https://http-inputs-nswdoe.splunkcloud.com/services/collector/event"
      SPLUNK_INDEX_TOKEN     = "49f84626-e53b-405e-9944-8b772f31189c"
      SPLUNK_REQUEST_CHANNEL = "c4e8ad02-9b5d-451c-b60e-829ce060d412"
      ENV: var.env
    }
  }
}

resource "aws_iam_role" "lambda_exec_role" {
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

  tags = {
    Environment = var.env
  }
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.splunk_forwarder.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:*"
}

resource "aws_iam_policy" "lambda_exec_policy" {
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
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_exec_policy_attachment" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_exec_policy.arn
}

data "aws_caller_identity" "current" {}
