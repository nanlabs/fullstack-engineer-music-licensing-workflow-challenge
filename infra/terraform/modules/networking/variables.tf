variable "project" {
  type        = string
  description = "Project name used for resource naming/tagging."
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)."
}

variable "vpc_cidr" {
  type        = string
  default     = "10.20.0.0/16"
  description = "CIDR block for the VPC."
}

variable "az_count" {
  type        = number
  default     = 2
  description = "Number of availability zones to spread subnets across."
}

variable "container_port" {
  type        = number
  default     = 8080
  description = "Port the backend container listens on (opened from the ALB security group)."
}
