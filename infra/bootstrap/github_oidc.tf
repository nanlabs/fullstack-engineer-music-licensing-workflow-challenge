# GitHub Actions authenticates with OIDC: no long-lived AWS keys in GitHub.
# Three roles, each trusting a different `sub` claim:
#   gha-plan        pull requests and manual runs from main: read-only + state read
#   gha-deploy-dev  jobs that declare `environment: dev`
#   gha-deploy-prod jobs that declare `environment: prod` (approval configured in GitHub)
# Protect both GitHub environments with "Deployment branches: main", otherwise
# any branch of the repository could declare the environment and assume the role.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  github_oidc_subject = "token.actions.githubusercontent.com:sub"
  github_oidc_aud     = "token.actions.githubusercontent.com:aud"
}

data "aws_iam_policy_document" "plan_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = local.github_oidc_aud
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = local.github_oidc_subject
      values = [
        "repo:${var.github_repository}:pull_request",
        "repo:${var.github_repository}:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "plan" {
  name               = "${var.project}-gha-plan"
  description        = "GitHub Actions: terraform plan on pull requests (read-only)"
  assume_role_policy = data.aws_iam_policy_document.plan_trust.json
}

resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/ReadOnlyAccess"
}

# Explicit, even though ReadOnlyAccess already covers it: the plan role must be
# able to read the state objects but never write them (plans run with -lock=false).
data "aws_iam_policy_document" "plan_state" {
  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
  }

  statement {
    sid       = "ReadEnvironmentState"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/envs/*"]
  }
}

resource "aws_iam_role_policy" "plan_state" {
  name   = "terraform-state-read"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan_state.json
}

data "aws_iam_policy_document" "deploy_trust" {
  for_each = local.environments

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = local.github_oidc_aud
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = local.github_oidc_subject
      values   = ["repo:${var.github_repository}:environment:${each.key}"]
    }
  }
}

# Terraform creates IAM roles, so the deploy roles are administrators. A
# permissions boundary is the documented next step if the account is shared.
resource "aws_iam_role" "deploy" {
  for_each = local.environments

  name               = "${var.project}-gha-deploy-${each.key}"
  description        = "GitHub Actions: terraform apply for the ${each.key} environment"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust[each.key].json
}

resource "aws_iam_role_policy_attachment" "deploy_admin" {
  for_each = local.environments

  role       = aws_iam_role.deploy[each.key].name
  policy_arn = "arn:${local.partition}:iam::aws:policy/AdministratorAccess"
}
