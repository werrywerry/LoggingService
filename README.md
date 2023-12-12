# CloudWatch to Splunk Logging Solution README #

### Overview ###
This README documents the CloudWatch to Splunk Logging Solution. This solution automates the forwarding of AWS CloudWatch logs to Splunk for analysis. It includes two AWS Lambda functions: SubscriptionFilterHandler and SplunkForwarder, along with necessary IAM roles, policies, and CloudWatch Event Rules.

### Components ###
- SubscriptionFilterHandler Lambda: Manages subscription filters for log groups in CloudWatch. It adds or removes Splunk forwarder subscription filters based on the environment settings.
- SplunkForwarder Lambda: Forwards log data from CloudWatch to Splunk. It retrieves the Splunk index token from AWS Secrets Manager, processes log events, and forwards them to Splunk.
- IAM Roles and Policies: Provide necessary permissions for the Lambda functions to interact with CloudWatch Logs, Secrets Manager, and other AWS services.
- CloudWatch Event Rule: Triggers the SubscriptionFilterHandler Lambda when a new log group is created.

### Prerequisites ###
- AWS CLI configured with appropriate permissions.
- Terraform installed for infrastructure deployment.

### Deployment ###
1. Configure Terraform Variables: Set the required variables in variables.tf (e.g., region, env).
2. Package Lambda Functions: Ensure that the source directories for the Lambda functions contain the latest code.
3. Run Terraform Commands:
    - Plan the deployment: terraform plan
    - Apply the configuration: terraform apply

### Deployment Using CI/CD ###
For deployment instructions using Jenkins CI/CD pipelines, please consult https://confluence.education.nsw.gov.au/pages/viewpage.action?pageId=482050120

### Configuration ###
- Environment Variables: Review and set environment variables in the Lambda function definitions in the Terraform script (e.g., SPLUNK_URL, SPLUNK_REQUEST_CHANNEL).
- IAM Roles and Policies: Verify the IAM roles and policies in the Terraform script for necessary permissions.

### Troubleshooting ###
- CloudWatch Logs: Check the CloudWatch Logs for both Lambda functions for error messages and debugging information.
- IAM Permissions: Ensure that the IAM roles have the correct permissions if encountering access issues.
- Lambda Execution: If Lambdas are not triggering correctly, verify the CloudWatch Event Rule and Lambda execution permissions.

### Maintenance ###
- Update Lambda Code: To update Lambda functions, replace the source code in the respective directories and redeploy using Terraform.
- Monitor AWS Resources: Regularly check AWS resources for any unexpected changes or usage.
