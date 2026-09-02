variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

variable "domain_aliases" {
  type        = list(string)
  default     = []
  description = "Custom domain names for the CloudFront distribution, if any."
}

variable "certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN (must be in us-east-1) for custom domain_aliases."
}
