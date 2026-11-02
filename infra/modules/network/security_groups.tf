# Security groups form a chain: CloudFront -> ALB -> ECS -> {RDS, cache}.
# The provider removes the implicit allow-all egress when it manages a group,
# so every group that must initiate connections declares its egress here.

data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.name}-alb-"
  description = "Internal ALB: reachable only from CloudFront VPC origins"
  vpc_id      = module.vpc.vpc_id

  tags = { Name = "${var.name}-alb" }

  lifecycle {
    create_before_destroy = true
  }
}

# The managed prefix list weighs 55 of the 60 rules a group may hold: keep it
# as the only ingress rule of this group.
resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from CloudFront origin-facing servers (VPC origin)"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the backend tasks"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group" "ecs" {
  name_prefix = "${var.name}-ecs-"
  description = "Backend tasks: traffic from the ALB only"
  vpc_id      = module.vpc.vpc_id

  tags = { Name = "${var.name}-ecs" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "HTTP from the internal ALB"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

# Tasks reach RDS and the cache inside the VPC and ECR, Secrets Manager,
# CloudWatch Logs and (optionally) Datadog through the NAT gateway.
resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  description       = "Outbound to the VPC and the internet through NAT"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.name}-rds-"
  description = "PostgreSQL: traffic from the backend tasks only"
  vpc_id      = module.vpc.vpc_id

  tags = { Name = "${var.name}-rds" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL from the backend tasks"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group" "cache" {
  name_prefix = "${var.name}-cache-"
  description = "ElastiCache Serverless: traffic from the backend tasks only"
  vpc_id      = module.vpc.vpc_id

  tags = { Name = "${var.name}-cache" }

  lifecycle {
    create_before_destroy = true
  }
}

# 6379 is the primary endpoint, 6380 the reader endpoint of a serverless cache.
resource "aws_vpc_security_group_ingress_rule" "cache_from_ecs" {
  security_group_id            = aws_security_group.cache.id
  description                  = "Valkey (TLS) from the backend tasks"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6380
  referenced_security_group_id = aws_security_group.ecs.id
}
