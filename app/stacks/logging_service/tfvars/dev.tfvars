env = "Dev"

tags = {
  cir_app_id                 = "logsrv"
  cir_dataclass              = "sensitive"
  Integration-Env            = "Dev"
  Integration-Component-Name = "LoggingService-SplunkLogForwarder"
  Integration-Version        = "v1"
  Integration-Branch         = "feature/initial"
  Integration-User           = "joel.bradley3@det.nsw.edu.au"
  Integration-Repository     = "https://bitbucket.org/nsw-education/loggingservice-splunklogforwarder/"
}

splunk_url             = "https://http-inputs-nswdoe.splunkcloud.com/services/collector/event"
splunk_request_channel = "c4e8ad02-9b5d-451c-b60e-829ce060d412"
