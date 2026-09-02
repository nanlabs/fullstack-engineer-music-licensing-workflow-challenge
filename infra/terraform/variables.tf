variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "music-licensing"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "backend_image_tag" {
  type        = string
  default     = "latest"
  description = "Tag of the backend image in ECR to deploy. Pushed by CI before `terraform apply`."
}

variable "frontend_domain_aliases" {
  type        = list(string)
  default     = []
  description = "Custom domain names for the CloudFront distribution (requires certificate_arn)."
}

variable "cloudfront_certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN in us-east-1 for the CloudFront custom domain, if any."
}

variable "alb_certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN (same region as aws_region) for HTTPS on the backend ALB, if any."
}

variable "backend_desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
