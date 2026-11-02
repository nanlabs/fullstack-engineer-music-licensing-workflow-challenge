output "state_bucket" {
  description = "S3 bucket holding the Terraform state of every root"
  value       = aws_s3_bucket.tfstate.bucket
}

output "plan_role_arn" {
  description = "IAM role assumed by pull-request plans"
  value       = aws_iam_role.plan.arn
}

output "deploy_role_arns" {
  description = "IAM roles assumed by the deploy workflow, per environment"
  value       = { for env, role in aws_iam_role.deploy : env => role.arn }
}

output "ecr_repository_url" {
  description = "Backend image repository"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_name" {
  description = "Backend image repository name (ECR_REPOSITORY variable in GitHub)"
  value       = aws_ecr_repository.backend.name
}

output "github_variables" {
  description = "Values to copy into the GitHub repository variables (AWS_ROLE_ARN goes into each environment)"
  value = {
    AWS_REGION        = var.region
    TF_STATE_BUCKET   = aws_s3_bucket.tfstate.bucket
    ECR_REPOSITORY    = aws_ecr_repository.backend.name
    AWS_PLAN_ROLE_ARN = aws_iam_role.plan.arn
    AWS_ROLE_ARN      = { for env, role in aws_iam_role.deploy : env => role.arn }
  }
}
