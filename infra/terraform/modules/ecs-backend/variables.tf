variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "container_image" {
  type        = string
  description = "Full ECR image URI, including tag."
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "cpu" {
  type    = number
  default = 256
}

variable "memory" {
  type    = number
  default = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "max_capacity" {
  type    = number
  default = 3
}

variable "database_url_secret_arn" {
  type        = string
  description = "ARN of the Secrets Manager secret holding DATABASE_URL."
}

variable "jwt_secret_arn" {
  type        = string
  description = "ARN of the Secrets Manager secret holding JWT_SECRET."
}

variable "cors_origin" {
  type        = string
  description = "Value for the CORS_ORIGIN env var (the CloudFront domain of the frontend)."
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "certificate_arn" {
  type        = string
  default     = null
  description = "ACM certificate ARN for HTTPS on the ALB. If null, the ALB listens on HTTP only."
}
