# One environment: network -> data -> edge -> backend. Sizing and safety
# switches live in the .auto.tfvars file next to this one.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = var.github_repository
    }
  }
}

data "aws_ecr_repository" "backend" {
  name = "${var.project}/backend"
}

locals {
  name = "${var.project}-${var.environment}"
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  cidr               = var.vpc_cidr
  single_nat_gateway = var.single_nat_gateway
  enable_flow_logs   = var.enable_flow_logs
}

module "data" {
  source = "../../modules/data"

  name          = local.name
  secret_prefix = "${var.project}/${var.environment}"

  private_subnet_ids         = module.network.private_subnet_ids
  database_subnet_group_name = module.network.database_subnet_group_name
  rds_security_group_id      = module.network.rds_security_group_id
  cache_security_group_id    = module.network.cache_security_group_id

  pg_version                  = var.pg_version
  pg_family                   = var.pg_family
  db_instance_class           = var.db_instance_class
  multi_az                    = var.multi_az
  backup_retention_period     = var.backup_retention_period
  deletion_protection         = var.deletion_protection
  skip_final_snapshot         = var.skip_final_snapshot
  apply_immediately           = var.apply_immediately
  enhanced_monitoring         = var.rds_enhanced_monitoring
  log_retention_days          = var.log_retention_days
  secrets_version             = var.secrets_version
  secret_recovery_window_days = var.secret_recovery_window_days
  enable_datadog              = var.enable_datadog
}

module "edge" {
  source = "../../modules/edge"

  name                  = local.name
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  deletion_protection   = var.deletion_protection
  force_destroy         = var.force_destroy
  enable_waf            = var.enable_waf
  waf_block             = var.waf_block
}

module "backend" {
  source = "../../modules/backend"

  name        = local.name
  environment = var.environment

  private_subnet_ids      = module.network.private_subnet_ids
  ecs_security_group_id   = module.network.ecs_security_group_id
  target_group_arn        = module.edge.target_group_arn
  alb_arn_suffix          = module.edge.alb_arn_suffix
  target_group_arn_suffix = module.edge.target_group_arn_suffix
  public_url              = module.edge.public_url

  database_url               = module.data.database_url
  database_identifier        = module.data.database_identifier
  redis_url                  = module.data.redis_url
  jwt_secret_arn             = module.data.jwt_secret_arn
  db_password_secret_arn     = module.data.db_password_secret_arn
  datadog_api_key_secret_arn = module.data.datadog_api_key_secret_arn

  ecr_repository_name      = data.aws_ecr_repository.backend.name
  ecr_repository_url       = data.aws_ecr_repository.backend.repository_url
  image_tag_parameter_name = "/${var.project}/${var.environment}/backend-image-tag"
  backend_image_tag        = var.backend_image_tag
  skip_image_check         = var.skip_image_check

  task_cpu                 = var.task_cpu
  task_memory              = var.task_memory
  desired_count            = var.desired_count
  autoscaling_min_capacity = var.autoscaling_min_capacity
  autoscaling_max_capacity = var.autoscaling_max_capacity
  capacity_provider        = var.capacity_provider
  container_insights       = var.container_insights
  enable_ecs_exec          = var.enable_ecs_exec
  log_retention_days       = var.log_retention_days
  enable_datadog           = var.enable_datadog
  datadog_site             = var.datadog_site
  create_alarms            = var.create_alarms
  alarm_email              = var.alarm_email
}
