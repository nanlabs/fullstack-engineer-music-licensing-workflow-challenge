output "distribution_id" {
  value = module.cloudfront.cloudfront_distribution_id
}

output "distribution_arn" {
  value = module.cloudfront.cloudfront_distribution_arn
}

output "distribution_domain_name" {
  value = module.cloudfront.cloudfront_distribution_domain_name
}

output "public_url" {
  value = "https://${module.cloudfront.cloudfront_distribution_domain_name}"
}

output "web_bucket" {
  value = aws_s3_bucket.web.id
}

output "alb_arn" {
  value = module.alb.arn
}

output "alb_arn_suffix" {
  value = module.alb.arn_suffix
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

# The service must not register before the target group hangs off the
# listener; depending on the whole ALB module here orders exactly that, without
# deferring the consumer module's data sources the way a module-level
# depends_on would.
output "target_group_arn" {
  value      = module.alb.target_groups["backend"].arn
  depends_on = [module.alb]
}

output "target_group_arn_suffix" {
  value = module.alb.target_groups["backend"].arn_suffix
}
