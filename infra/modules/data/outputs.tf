output "database_address" {
  value = module.rds.db_instance_address
}

output "database_identifier" {
  value = module.rds.db_instance_identifier
}

# No password in the URL: sqlx reads PGPASSWORD from the environment and the
# task gets it from Secrets Manager. `require` encrypts the connection without
# verifying the RDS certificate chain (rds.force_ssl is on).
output "database_url" {
  value = "postgres://${local.db_username}@${module.rds.db_instance_address}:${local.db_port}/${local.db_name}?sslmode=require"
}

output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}

output "datadog_api_key_secret_arn" {
  value = var.enable_datadog ? aws_secretsmanager_secret.datadog_api_key[0].arn : null
}

output "cache_endpoint" {
  value = module.valkey.serverless_cache_endpoint[0].address
}

output "cache_name" {
  value = "${var.name}-valkey"
}

output "redis_url" {
  value = "rediss://${module.valkey.serverless_cache_endpoint[0].address}:${module.valkey.serverless_cache_endpoint[0].port}"
}
