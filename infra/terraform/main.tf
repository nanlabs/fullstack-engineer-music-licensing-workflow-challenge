module "networking" {
  source = "./modules/networking"

  project     = var.project
  environment = var.environment
}

module "database" {
  source = "./modules/database"

  project           = var.project
  environment       = var.environment
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.rds_security_group_id
  instance_class    = var.db_instance_class
}

module "ecr_backend" {
  source = "./modules/ecr"

  project     = var.project
  environment = var.environment
  name        = "backend"
}

# JWT signing secret for the backend. Generated once and stored in Secrets
# Manager; rotate manually by tainting this resource if ever needed.
resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.project}-${var.environment}-jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

module "frontend_static" {
  source = "./modules/frontend-static"

  project         = var.project
  environment     = var.environment
  domain_aliases  = var.frontend_domain_aliases
  certificate_arn = var.cloudfront_certificate_arn
}

module "ecs_backend" {
  source = "./modules/ecs-backend"

  project     = var.project
  environment = var.environment

  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  ecs_security_group_id = module.networking.ecs_security_group_id

  container_image = "${module.ecr_backend.repository_url}:${var.backend_image_tag}"
  desired_count   = var.backend_desired_count
  certificate_arn = var.alb_certificate_arn

  database_url_secret_arn = module.database.database_url_secret_arn
  jwt_secret_arn          = aws_secretsmanager_secret.jwt_secret.arn

  # The SPA calls the ALB directly (see infra/README.md) rather than through
  # CloudFront, so CORS must allow the CloudFront domain explicitly.
  cors_origin = "https://${module.frontend_static.distribution_domain_name}"
}
