# The backend on ECS Fargate (ARM64): cluster, service with rolling deployments
# behind the internal ALB, CPU-based autoscaling, CloudWatch logs, optional
# Datadog sidecar and CloudWatch alarms.

# Which image runs: the tag passed by the deploy workflow, or the one the last
# deployment recorded in SSM, so an infrastructure-only apply keeps the image.
data "aws_ssm_parameter" "image_tag" {
  name = var.image_tag_parameter_name
}

locals {
  image_tag = coalesce(var.backend_image_tag, nonsensitive(data.aws_ssm_parameter.image_tag.value))
  image     = "${var.ecr_repository_url}:${local.image_tag}"

  backend_log_group = "/aws/ecs/${var.name}/backend"
  datadog_log_group = "/aws/ecs/${var.name}/datadog-agent"
}

# Fails the plan when the tag does not exist in ECR. A service created with a
# missing image would stall (the circuit breaker has no earlier deployment to
# roll back to). Pull-request plans skip it: their tag is not built yet.
data "aws_ecr_image" "backend" {
  count = var.skip_image_check ? 0 : 1

  repository_name = var.ecr_repository_name
  image_tag       = local.image_tag
}
