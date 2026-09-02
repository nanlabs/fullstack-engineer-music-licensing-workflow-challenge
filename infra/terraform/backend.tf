terraform {
  backend "s3" {
    # Bucket/key/region/dynamodb_table are supplied at `terraform init` time
    # via -backend-config, both locally (backend-config.hcl, gitignored) and
    # in CI (.github/workflows/deploy.yml). See infra/README.md for the
    # one-time bootstrap steps that create this bucket + lock table.
  }
}
