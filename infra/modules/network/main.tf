# VPC with three subnet tiers per availability zone:
#   public    NAT gateways only (nothing of ours has a public IP)
#   private   internal ALB, ECS tasks, ElastiCache Serverless
#   database  RDS
# The internet gateway is required by CloudFront VPC origins even though no
# traffic from the internet is routed into the VPC.

data "aws_availability_zones" "available" {
  state            = "available"
  exclude_zone_ids = var.excluded_zone_ids

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  azs = slice(sort(data.aws_availability_zones.available.names), 0, var.az_count)

  public_subnets   = [for i in range(var.az_count) : cidrsubnet(var.cidr, 8, i)]
  private_subnets  = [for i in range(var.az_count) : cidrsubnet(var.cidr, 8, 10 + i)]
  database_subnets = [for i in range(var.az_count) : cidrsubnet(var.cidr, 8, 20 + i)]
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = var.name
  cidr = var.cidr
  azs  = local.azs

  public_subnets   = local.public_subnets
  private_subnets  = local.private_subnets
  database_subnets = local.database_subnets

  create_database_subnet_group = true
  map_public_ip_on_launch      = false

  enable_nat_gateway     = true
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway

  enable_dns_hostnames = true
  enable_dns_support   = true

  enable_flow_log                                 = var.enable_flow_logs
  create_flow_log_cloudwatch_iam_role             = var.enable_flow_logs
  create_flow_log_cloudwatch_log_group            = var.enable_flow_logs
  flow_log_cloudwatch_log_group_retention_in_days = 7
  flow_log_max_aggregation_interval               = 600

  public_subnet_tags   = { Tier = "public" }
  private_subnet_tags  = { Tier = "private" }
  database_subnet_tags = { Tier = "database" }
}

# ECR image layers are served from S3; the gateway endpoint keeps those pulls
# off the NAT gateway. Interface endpoints would cost more than the NAT itself.
module "vpc_endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "~> 6.7"

  vpc_id = module.vpc.vpc_id

  endpoints = {
    s3 = {
      service         = "s3"
      service_type    = "Gateway"
      route_table_ids = concat(module.vpc.private_route_table_ids, module.vpc.database_route_table_ids)
      tags            = { Name = "${var.name}-s3" }
    }
  }
}
