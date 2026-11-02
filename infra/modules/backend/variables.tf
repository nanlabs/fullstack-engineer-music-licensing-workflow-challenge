variable "name" {
  description = "Name prefix, e.g. music-licensing-dev"
  type        = string
}

variable "environment" {
  description = "Environment label (dev, prod)"
  type        = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "public_url" {
  description = "Public origin of the application (CloudFront), used for CORS and invitation links"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL URL without password (PGPASSWORD comes from Secrets Manager)"
  type        = string
}

variable "database_identifier" {
  type = string
}

variable "database_max_connections" {
  type    = number
  default = 10
}

variable "redis_url" {
  description = "rediss:// URL of the Valkey cache"
  type        = string
}

variable "jwt_secret_arn" {
  type = string
}

variable "db_password_secret_arn" {
  type = string
}

variable "datadog_api_key_secret_arn" {
  type    = string
  default = null
}

variable "ecr_repository_name" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "image_tag_parameter_name" {
  description = "SSM parameter that records the deployed image tag"
  type        = string
}

variable "backend_image_tag" {
  description = "Image tag to deploy; null reads the tag recorded in SSM"
  type        = string
  default     = null
}

variable "skip_image_check" {
  description = "Do not verify that the image tag exists in ECR (pull-request plans only)"
  type        = bool
  default     = false
}

variable "task_cpu" {
  description = "Task CPU units (256 = 0.25 vCPU)"
  type        = number
}

variable "task_memory" {
  description = "Task memory in MiB"
  type        = number
}

variable "desired_count" {
  type = number
}

variable "autoscaling_min_capacity" {
  type = number
}

variable "autoscaling_max_capacity" {
  type = number
}

variable "capacity_provider" {
  description = "FARGATE or FARGATE_SPOT"
  type        = string

  validation {
    condition     = contains(["FARGATE", "FARGATE_SPOT"], var.capacity_provider)
    error_message = "capacity_provider must be FARGATE or FARGATE_SPOT."
  }
}

variable "container_insights" {
  description = "Container Insights setting: disabled, enabled or enhanced"
  type        = string
  default     = "enabled"
}

variable "enable_ecs_exec" {
  description = "Allow `aws ecs execute-command` (makes the root filesystem writable)"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  type = number
}

variable "rust_log" {
  type    = string
  default = "info"
}

variable "enable_datadog" {
  description = "Run the Datadog agent as a sidecar and point the backend's OTLP exporter at it"
  type        = bool
  default     = false
}

variable "datadog_site" {
  type    = string
  default = "datadoghq.com"
}

variable "create_alarms" {
  type    = bool
  default = false
}

variable "alarm_email" {
  description = "E-mail subscribed to the alarm topic; null creates the topic without subscribers"
  type        = string
  default     = null
}
