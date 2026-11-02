module "cluster" {
  source  = "terraform-aws-modules/ecs/aws//modules/cluster"
  version = "~> 7.6"

  name = var.name

  setting = [
    {
      name  = "containerInsights"
      value = var.container_insights
    },
  ]

  # Exec session logging would need extra log permissions on the task role;
  # sessions are only enabled in dev, so they are not logged.
  configuration = {
    execute_command_configuration = {
      logging = "NONE"
    }
  }
  create_cloudwatch_log_group = false

  cluster_capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy = {
    main = {
      name   = var.capacity_provider
      weight = 100
      base   = 1
    }
  }
}
