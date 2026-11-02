# Account-level, applied once by a human: the Terraform state bucket, the
# GitHub OIDC trust, the ECR repository shared by both environments, the SSM
# parameters that remember which image each environment runs, and a budget.
# Starts with local state; see backend.tf.example to move it into the bucket.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = "bootstrap"
      ManagedBy   = "terraform"
      Repository  = var.github_repository
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  partition    = data.aws_partition.current.partition
  state_bucket = "${var.project}-tfstate-${local.account_id}"
  environments = toset(["dev", "prod"])
}
