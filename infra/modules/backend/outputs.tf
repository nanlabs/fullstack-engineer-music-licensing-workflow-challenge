output "cluster_name" {
  value = module.cluster.name
}

output "service_name" {
  value = module.service.name
}

output "task_definition_arn" {
  value = module.service.task_definition_arn
}

output "image" {
  value = local.image
}

output "image_tag" {
  value = local.image_tag
}

output "backend_log_group" {
  value = local.backend_log_group
}

# Digest of the image the data source verified; null when the check is skipped.
output "image_digest" {
  value = var.skip_image_check ? null : data.aws_ecr_image.backend[0].image_digest
}
