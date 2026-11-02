# Secrets are generated here and handed to RDS and Secrets Manager through
# write-only arguments: Terraform never reads them back, so a read-only plan
# role cannot see them and they are not refreshed on every plan. The values do
# live in the state as random_password results (the state bucket is private,
# encrypted and versioned). Rotation: bump `secrets_version` and replace the
# random_password resource (see infra/README.md).

resource "random_password" "db" {
  length  = 48
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.secret_prefix}/db-password"
  description             = "PostgreSQL master password, injected into the backend task as PGPASSWORD"
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id                = aws_secretsmanager_secret.db_password.id
  secret_string_wo         = random_password.db.result
  secret_string_wo_version = var.secrets_version
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.secret_prefix}/jwt-secret"
  description             = "HMAC key for the backend access and refresh tokens (JWT_SECRET)"
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id                = aws_secretsmanager_secret.jwt.id
  secret_string_wo         = random_password.jwt.result
  secret_string_wo_version = var.secrets_version
}

# The Datadog API key is never known to Terraform: the secret is created with
# a placeholder at a fixed write-only version and filled in by hand with
# `aws secretsmanager put-secret-value`.
resource "aws_secretsmanager_secret" "datadog_api_key" {
  count = var.enable_datadog ? 1 : 0

  name                    = "${var.secret_prefix}/datadog-api-key"
  description             = "Datadog API key for the agent sidecar; set it with put-secret-value"
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "datadog_api_key" {
  count = var.enable_datadog ? 1 : 0

  secret_id                = aws_secretsmanager_secret.datadog_api_key[0].id
  secret_string_wo         = "replace-me-with-the-datadog-api-key"
  secret_string_wo_version = 1
}
