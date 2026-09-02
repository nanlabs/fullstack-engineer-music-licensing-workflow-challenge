output "frontend_url" {
  value       = "https://${module.frontend_static.distribution_domain_name}"
  description = "CloudFront URL for the SPA."
}

output "backend_url" {
  value       = "http://${module.ecs_backend.alb_dns_name}"
  description = "ALB URL for the backend API (use https:// if alb_certificate_arn is set)."
}

output "backend_ecr_repository_url" {
  value       = module.ecr_backend.repository_url
  description = "Push backend images here before running `terraform apply` (or before updating backend_image_tag)."
}

output "frontend_bucket_name" {
  value = module.frontend_static.bucket_name
}

output "cloudfront_distribution_id" {
  value       = module.frontend_static.distribution_id
  description = "Used to invalidate the CDN cache after deploying new frontend assets."
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "ecs_cluster_name" {
  value = module.ecs_backend.cluster_name
}

output "ecs_service_name" {
  value = module.ecs_backend.service_name
}

