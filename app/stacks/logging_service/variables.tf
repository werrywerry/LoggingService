# This is where you put your variables declaration
variable "env" {
  type = string
}

variable "splunk_url" {
  type = string
}

variable "splunk_request_channel" {
  type = string
}

variable "tags" {
  description = "A mapping of tags to assign the resource"
  type = map(string)
  default = {}
}

variable "aws_account_id" {
  type = string
  description = "AWS Account ID"
  default = 318468042250
}

variable "region" {
  type = string
  description = "AWS Region"
  default = "ap-southeast-2"
}
