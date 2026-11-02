# The deploy workflow writes the tag it just rolled out; the environment roots
# read it so an infrastructure-only apply never changes the running image.
# The placeholder is only valid until the first deployment (the environment
# roots refuse to plan with a tag that does not exist in ECR).

resource "aws_ssm_parameter" "backend_image_tag" {
  for_each = local.environments

  name        = "/${var.project}/${each.key}/backend-image-tag"
  description = "ECR tag of the backend image deployed to ${each.key}; written by the deploy workflow"
  type        = "String"
  value       = "bootstrap"

  lifecycle {
    ignore_changes = [value]
  }
}
