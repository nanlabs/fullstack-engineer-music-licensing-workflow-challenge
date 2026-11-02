# Partial backend configuration: the bucket name carries the account id and
# backend blocks cannot read variables, so it comes from
# `terraform init -backend-config="bucket=$TF_STATE_BUCKET"`.
terraform {
  backend "s3" {
    key          = "envs/prod/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
