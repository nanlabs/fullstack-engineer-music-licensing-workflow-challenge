locals {
  name = "${var.project}-${var.environment}"
}

resource "random_password" "master" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = var.subnet_ids

  tags = { Name = local.name }
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = var.engine_version

  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_days
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name}-final"
  deletion_protection       = !var.skip_final_snapshot

  tags = { Name = local.name }
}

# Stored so the ECS task definition can pull it at deploy time instead of
# baking credentials into Terraform state consumers.
resource "aws_secretsmanager_secret" "db_url" {
  name = "${local.name}-database-url"
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "postgres://${var.db_username}:${random_password.master.result}@${aws_db_instance.main.address}:5432/${var.db_name}"
}
