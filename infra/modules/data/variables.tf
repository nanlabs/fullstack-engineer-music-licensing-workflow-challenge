variable "name" {
  description = "Name prefix, e.g. music-licensing-dev"
  type        = string
}

variable "secret_prefix" {
  description = "Secrets Manager name prefix, e.g. music-licensing/dev"
  type        = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "database_subnet_group_name" {
  type = string
}

variable "rds_security_group_id" {
  type = string
}

variable "cache_security_group_id" {
  type = string
}

variable "pg_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "18"
}

variable "pg_family" {
  description = "RDS parameter group family matching pg_version"
  type        = string
  default     = "postgres18"
}

variable "db_instance_class" {
  type = string
}

variable "multi_az" {
  type = bool
}

variable "backup_retention_period" {
  description = "Days of automated backups"
  type        = number
}

variable "deletion_protection" {
  type = bool
}

variable "skip_final_snapshot" {
  type = bool
}

variable "apply_immediately" {
  description = "Apply RDS changes right away instead of in the maintenance window"
  type        = bool
  default     = false
}

variable "enhanced_monitoring" {
  description = "RDS enhanced monitoring every 60 s (creates the monitoring role)"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  type = number
}

variable "secrets_version" {
  description = "Bump together with `-replace=random_password.<name>` to rotate the database password or the JWT secret"
  type        = number
  default     = 1
}

variable "secret_recovery_window_days" {
  description = "Days a deleted secret can be recovered; 0 deletes immediately (dev)"
  type        = number
  default     = 7
}

variable "enable_datadog" {
  description = "Create the secret that holds the Datadog API key"
  type        = bool
  default     = false
}

variable "cache_max_storage_gb" {
  description = "Cap on serverless cache storage (minimum 1)"
  type        = number
  default     = 1
}

variable "cache_max_ecpu_per_second" {
  description = "Cap on serverless cache processing units per second (minimum 1000)"
  type        = number
  default     = 1000
}
