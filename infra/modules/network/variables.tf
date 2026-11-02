variable "name" {
  description = "Name prefix, e.g. music-licensing-dev"
  type        = string
}

variable "cidr" {
  description = "VPC CIDR block; subnets are carved as /24s"
  type        = string
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

variable "excluded_zone_ids" {
  description = "Zone ids that must not be used (use1-az3 does not support CloudFront VPC origins)"
  type        = list(string)
  default     = ["use1-az3"]
}

variable "single_nat_gateway" {
  description = "One NAT gateway for the whole VPC (cheaper) instead of one per availability zone"
  type        = bool
}

variable "enable_flow_logs" {
  description = "Send VPC flow logs to CloudWatch Logs"
  type        = bool
  default     = false
}
