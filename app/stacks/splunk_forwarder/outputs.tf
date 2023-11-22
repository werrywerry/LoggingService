output "lambda_function_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.function_name
}

output "lambda_function_arn" {
  description = "The ARN of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.arn
}

output "lambda_function_invoke_arn" {
  description = "The Invoke ARN of the Lambda function."
  value       = aws_lambda_function.splunk_forwarder.invoke_arn
}

output "lambda_function_last_modified" {
  description = "The date the Lambda function was last modified."
  value       = aws_lambda_function.splunk_forwarder.last_modified
}

output "lambda_exec_role_arn" {
  description = "The ARN of the IAM role assumed by the Lambda function."
  value       = aws_iam_role.lambda_exec_role.arn
}

output "lambda_exec_policy_arn" {
  description = "The ARN of the IAM policy attached to the Lambda function."
  value       = aws_iam_policy.lambda_exec_policy.arn
}

output "lambda_exec_policy_attachment_id" {
  description = "The ID of the IAM policy attachment."
  value       = aws_iam_role_policy_attachment.lambda_exec_policy_attachment.id
}