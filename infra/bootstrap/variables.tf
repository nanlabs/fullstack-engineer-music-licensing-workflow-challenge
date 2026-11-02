variable "project" {
  description = "Name prefix for every resource"
  type        = string
  default     = "music-licensing"
}

variable "region" {
  description = "AWS region (CloudFront VPC origins and WAF for CloudFront require us-east-1 resources)"
  type        = string
  default     = "us-east-1"
}

variable "github_repository" {
  description = "GitHub repository (owner/name) allowed to assume the deploy roles through OIDC"
  type        = string
  default     = "Edartruwu/fullstack-engineer-music-licensing-workflow-challenge"
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget for the account, in USD"
  type        = number
  default     = 350
}

variable "budget_email" {
  description = "E-mail address for budget alerts; null disables the notifications"
  type        = string
  default     = null
}

variable "ecr_force_delete" {
  description = "Delete the ECR repository even if it still holds images (teardown only)"
  type        = bool
  default     = false
}
