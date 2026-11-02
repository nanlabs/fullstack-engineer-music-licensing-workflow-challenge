# Internal application load balancer in the private subnets. Plain HTTP
# between CloudFront and the ALB: the hop never leaves the VPC and an HTTPS
# listener would need a certificate for a domain we do not have.

module "alb" {
  source  = "terraform-aws-modules/alb/aws"
  version = "~> 10.5"

  name               = "${var.name}-api"
  internal           = true
  load_balancer_type = "application"
  vpc_id             = var.vpc_id
  subnets            = var.private_subnet_ids

  create_security_group = false
  security_groups       = [var.alb_security_group_id]

  # The backend sends an SSE keep-alive every 15 s; 120 s leaves room for slow
  # requests without keeping dead connections around.
  idle_timeout               = 120
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection

  listeners = {
    http = {
      port     = 80
      protocol = "HTTP"

      forward = {
        target_group_key = "backend"
      }
    }
  }

  target_groups = {
    backend = {
      name_prefix          = "be-"
      protocol             = "HTTP"
      port                 = 8080
      target_type          = "ip"
      create_attachment    = false
      deregistration_delay = 15

      # /health answers 503 while the database is unreachable; five misses
      # (150 s) ride out a Multi-AZ failover without replacing healthy tasks.
      health_check = {
        enabled             = true
        path                = "/health"
        matcher             = "200"
        protocol            = "HTTP"
        interval            = 30
        timeout             = 5
        healthy_threshold   = 2
        unhealthy_threshold = 5
      }
    }
  }
}
