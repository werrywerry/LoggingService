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
        "timeout" : 15,
        "concurrency" : 120,
        "memory" : 192
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
        "ruleName" : "LoggingService-NewLogGroupCreated-${var.env}"
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
    "LoggingService-SubscriptionFilterHandler-${var.env}" = {
      success_rate_threshold            = null
      errors_threshold                  = null
      duration_threshold                = 15000
      memory_underutilization_threshold = null
      memory_overutilization_threshold  = 127
      concurrent_executions_threshold   = 1
      throttles_threshold               = null
    },
    "LoggingService-SplunkForwarder-${var.env}" = {
      success_rate_threshold            = null
      errors_threshold                  = null
      duration_threshold                = 3000
      memory_underutilization_threshold = null
      memory_overutilization_threshold  = 176
      concurrent_executions_threshold   = 110
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
