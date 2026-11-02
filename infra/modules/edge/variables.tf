variable "name" {
  description = "Name prefix, e.g. music-licensing-dev"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "deletion_protection" {
  description = "Protect the load balancer from deletion"
  type        = bool
}

variable "force_destroy" {
  description = "Allow destroying the web bucket while it still holds objects (dev)"
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = "Attach a WAF web ACL with managed rules to the distribution"
  type        = bool
  default     = false
}

variable "waf_block" {
  description = "Managed rule groups block (true) or only count (false) matching requests"
  type        = bool
  default     = false
}
