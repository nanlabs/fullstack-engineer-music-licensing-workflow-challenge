module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 7.2"

  identifier = "${var.name}-postgres"

  engine               = "postgres"
  engine_version       = var.pg_version
  family               = var.pg_family
  major_engine_version = var.pg_version
  instance_class       = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = local.db_name
  username = local.db_username
  port     = local.db_port

  # RDS-managed passwords rotate every 7 days and ECS only injects secrets at
  # task start, so the password is ours and hands over through a write-only
  # argument instead.
  manage_master_user_password = false
  password_wo                 = random_password.db.result
  password_wo_version         = var.secrets_version

  multi_az               = var.multi_az
  create_db_subnet_group = false
  db_subnet_group_name   = var.database_subnet_group_name
  vpc_security_group_ids = [var.rds_security_group_id]

  # PostgreSQL has no option groups; the module would create an empty one.
  create_db_option_group = false

  parameters = [
    {
      name         = "rds.force_ssl"
      value        = "1"
      apply_method = "immediate"
    },
  ]

  backup_retention_period          = var.backup_retention_period
  backup_window                    = "03:00-04:00"
  maintenance_window               = "Sun:04:30-Sun:05:30"
  copy_tags_to_snapshot            = true
  deletion_protection              = var.deletion_protection
  skip_final_snapshot              = var.skip_final_snapshot
  final_snapshot_identifier_prefix = "final"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = var.enhanced_monitoring ? 60 : 0
  create_monitoring_role                = var.enhanced_monitoring
  monitoring_role_name                  = "${var.name}-rds-monitoring"
  monitoring_role_use_name_prefix       = true

  enabled_cloudwatch_logs_exports        = ["postgresql"]
  create_cloudwatch_log_group            = true
  cloudwatch_log_group_retention_in_days = var.log_retention_days

  auto_minor_version_upgrade = true
  apply_immediately          = var.apply_immediately
  ca_cert_identifier         = "rds-ca-rsa2048-g1"
}
