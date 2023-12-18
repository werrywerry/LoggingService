module "cloudwatch_alarms" {
  source = "git@bitbucket.org:nsw-education/terraform-module-cloudwatch-alarms.git?ref=release/1.0.1"

  env = var.env

  service_name = "LoggingService"

  resource_list = {
    "lambdas" : [
      {
        "lambda" : "LoggingService-SubscriptionFilterHandler-${var.env}",
        "timeout" : 900,
        "concurrency" : 1,
        "memory" : 128
      },
      {
        "lambda" : "LoggingService-SplunkForwarder-${var.env}",
        "timeout" : 3,
        "concurrency" : 10,
        "memory" : 128
      }
    ],
    "rdss" : [
    ],
    "apis" : [
    ],
    "dynamos" : [
    ],
    "eventbridges" : [
      {
        "name" : "default",
        "ruleName" : "LoggingService-NewLogGroupCreated-Dev"
      }
    ],
    "queues" : [
    ],
    "sns_subscriptions" : [
    ]
  }

    eventbridge_thresholds = {
    "default" = {
        "eventbridge_dead_letter_threshold" : null
    }
  }

  lambda_thresholds = {
    "LoggingService-SubscriptionFilterHandler-Dev" = {
      success_rate_threshold            = null
      errors_threshold                  = null
      duration_threshold                = 120
      memory_underutilization_threshold = null
      memory_overutilization_threshold  = null
      concurrent_executions_threshold   = null
      throttles_threshold               = null
    },
    "LoggingService-SplunkForwarder-Dev" = {
      success_rate_threshold            = null
      errors_threshold                  = null
      duration_threshold                = 2
      memory_underutilization_threshold = null
      memory_overutilization_threshold  = null
      concurrent_executions_threshold   = null
      throttles_threshold               = null
    }
  }
}

module "cloudwatch_dashboards" {
  source = "git@bitbucket.org:nsw-education/terraform-module-cloudwatch-dashboards.git?ref=release/1.0.0"

  env = module.cloudwatch_alarms.env

  service_name = module.cloudwatch_alarms.service_name

  resource_list = module.cloudwatch_alarms.resource_list
}
