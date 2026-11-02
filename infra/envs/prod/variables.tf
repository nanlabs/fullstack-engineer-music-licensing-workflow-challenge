variable "project" {
  type    = string
  default = "music-licensing"
}

variable "environment" {
  description = "dev or prod; set in the .auto.tfvars file"
  type        = string
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "github_repository" {
  type    = string
  default = "Edartruwu/fullstack-engineer-music-licensing-workflow-challenge"
}

# Network
variable "vpc_cidr" {
  type = string
}

variable "single_nat_gateway" {
  type = bool
}

variable "enable_flow_logs" {
  type    = bool
  default = false
}

# Database
variable "pg_version" {
  type    = string
  default = "18"
}

variable "pg_family" {
  type    = string
  default = "postgres18"
}

variable "db_instance_class" {
  type = string
}

variable "multi_az" {
  type = bool
}

variable "backup_retention_period" {
  type = number
}

variable "rds_enhanced_monitoring" {
  type    = bool
  default = false
}

# Safety switches
variable "deletion_protection" {
  type = bool
}

variable "skip_final_snapshot" {
  type = bool
}

variable "apply_immediately" {
  type    = bool
  default = false
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "secrets_version" {
  type    = number
  default = 1
}

variable "secret_recovery_window_days" {
  type    = number
  default = 7
}

# Backend service
variable "task_cpu" {
  type = number
}

variable "task_memory" {
  type = number
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
  type = string
}

variable "container_insights" {
  type    = string
  default = "enabled"
}

variable "enable_ecs_exec" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type = number
}

variable "backend_image_tag" {
  description = "ECR tag to deploy; passed by the deploy workflow, otherwise the SSM parameter is used"
  type        = string
  default     = null
}

variable "skip_image_check" {
  type    = bool
  default = false
}

# Edge
variable "enable_waf" {
  type    = bool
  default = false
}

variable "waf_block" {
  type    = bool
  default = false
}

# Observability
variable "create_alarms" {
  type    = bool
  default = false
}

variable "alarm_email" {
  type    = string
  default = null
}

variable "enable_datadog" {
  type    = bool
  default = false
}

variable "datadog_site" {
  type    = string
  default = "datadoghq.com"
}
