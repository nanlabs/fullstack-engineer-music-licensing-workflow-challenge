output "endpoint" {
  value = aws_db_instance.main.address
}

output "database_url_secret_arn" {
  value = aws_secretsmanager_secret.db_url.arn
}
