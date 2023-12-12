output "splunk_forwarder_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.function_name
}

output "splunk_forwarder_arn" {
  description = "The ARN of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.arn
}

output "splunk_forwarder_invoke_arn" {
  description = "The Invoke ARN of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.invoke_arn
}

output "splunk_forwarder_last_modified" {
  description = "The date the Lambda function was last modified."
  value       = aws_lambda_function.splunk_forwarder.last_modified
}

output "splunk_forwarder_exec_role_arn" {
  description = "The ARN of the IAM role assumed by the Lambda function."
  value       = aws_iam_role.splunk_forwarder_exec_role.arn
}

output "subscription_filter_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.subscription_filter_handler.function_name
}

output "subscription_filter_arn" {
  description = "The ARN of the Lambda function."
  value       = aws_lambda_function.subscription_filter_handler.arn
}

output "subscription_filter_invoke_arn" {
  description = "The Invoke ARN of the Lambda function."
  value       = aws_lambda_function.subscription_filter_handler.invoke_arn
}

output "subscription_filter_last_modified" {
  description = "The date the Lambda function was last modified."
  value       = aws_lambda_function.subscription_filter_handler.last_modified
}

output "subscription_filter_exec_role_arn" {
  description = "The ARN of the IAM role assumed by the Lambda function."
  value       = aws_iam_role.subscription_filter_exec_role.arn
}
