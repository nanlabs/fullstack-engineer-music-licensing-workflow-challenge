output "public_url" {
  description = "Where the application lives"
  value       = module.edge.public_url
}

output "distribution_id" {
  description = "CloudFront distribution (invalidate after a frontend deploy)"
  value       = module.edge.distribution_id
}

output "web_bucket" {
  description = "S3 bucket that holds the frontend build"
  value       = module.edge.web_bucket
}

output "alb_dns_name" {
  description = "Internal ALB, reachable only inside the VPC"
  value       = module.edge.alb_dns_name
}

output "cluster_name" {
  value = module.backend.cluster_name
}

output "service_name" {
  value = module.backend.service_name
}

output "backend_log_group" {
  description = "CloudWatch log group of the backend (OTP codes and invitation links are printed here)"
  value       = module.backend.backend_log_group
}

output "image" {
  value = module.backend.image
}

output "image_digest" {
  value = module.backend.image_digest
}

output "database_endpoint" {
  value = module.data.database_address
}

output "cache_endpoint" {
  value = module.data.cache_endpoint
}
