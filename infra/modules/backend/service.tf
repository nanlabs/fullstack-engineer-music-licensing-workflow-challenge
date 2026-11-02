locals {
  backend_environment_map = merge(
    {
      APP_ENV                  = "production"
      HOST                     = "0.0.0.0"
      PORT                     = "8080"
      LOG_FORMAT               = "json"
      RUST_LOG                 = var.rust_log
      SERVICE_NAME             = "${var.name}-backend"
      CORS_ORIGINS             = var.public_url
      APP_PUBLIC_URL           = var.public_url
      DATABASE_URL             = var.database_url
      DATABASE_MAX_CONNECTIONS = tostring(var.database_max_connections)
      REDIS_URL                = var.redis_url
    },
    var.enable_datadog ? { OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4317" } : {},
  )

  backend_environment = [
    for key, value in local.backend_environment_map : { name = key, value = value }
  ]

  datadog_environment = [
    { name = "ECS_FARGATE", value = "true" },
    { name = "DD_SITE", value = var.datadog_site },
    { name = "DD_ENV", value = var.environment },
    { name = "DD_SERVICE", value = "${var.name}-backend" },
    { name = "DD_APM_ENABLED", value = "true" },
    { name = "DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT", value = "0.0.0.0:4317" },
    { name = "DD_OTLP_CONFIG_LOGS_ENABLED", value = "true" },
    { name = "DD_LOGS_ENABLED", value = "true" },
  ]

  backend_container = {
    backend = {
      image     = local.image
      essential = true

      # ECS Exec needs a writable root (the SSM agent lives in the container);
      # the binary itself never writes to disk.
      readonlyRootFilesystem = !var.enable_ecs_exec

      portMappings = [
        {
          name          = "http"
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        },
      ]

      environment = local.backend_environment

      secrets = [
        { name = "JWT_SECRET", valueFrom = var.jwt_secret_arn },
        { name = "PGPASSWORD", valueFrom = var.db_password_secret_arn },
      ]

      # /health touches the database: give a Multi-AZ failover (60-120 s) and
      # the first migrations on an empty database room to finish.
      healthCheck = {
        command     = ["CMD-SHELL", "curl -fsS http://localhost:8080/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 6
        startPeriod = 180
      }

      enable_cloudwatch_logging              = true
      cloudwatch_log_group_name              = local.backend_log_group
      cloudwatch_log_group_retention_in_days = var.log_retention_days
    }
  }

  datadog_container = var.enable_datadog ? {
    datadog-agent = {
      image                  = "public.ecr.aws/datadog/agent:7"
      essential              = false
      readonlyRootFilesystem = false
      environment            = local.datadog_environment

      secrets = [
        { name = "DD_API_KEY", valueFrom = var.datadog_api_key_secret_arn },
      ]

      enable_cloudwatch_logging              = true
      cloudwatch_log_group_name              = local.datadog_log_group
      cloudwatch_log_group_retention_in_days = var.log_retention_days
    }
  } : {}
}

module "service" {
  source  = "terraform-aws-modules/ecs/aws//modules/service"
  version = "~> 7.6"

  # Service name and task family are account-wide: keep the environment in them.
  name        = "${var.name}-backend"
  cluster_arn = module.cluster.arn

  cpu    = var.task_cpu
  memory = var.task_memory

  runtime_platform = {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }

  desired_count = var.desired_count

  capacity_provider_strategy = {
    main = {
      capacity_provider = var.capacity_provider
      weight            = 100
      base              = 1
    }
  }
  force_new_deployment = true

  subnet_ids            = var.private_subnet_ids
  create_security_group = false
  security_group_ids    = [var.ecs_security_group_id]
  assign_public_ip      = false

  enable_execute_command            = var.enable_ecs_exec
  health_check_grace_period_seconds = 180

  # Rolling deployment: new tasks must pass the ALB health check or the
  # deployment rolls back; the apply waits for the outcome so a rollback
  # fails the pipeline instead of silently keeping the old image.
  deployment_circuit_breaker = {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  wait_for_steady_state              = true

  timeouts = {
    create = "30m"
    update = "30m"
    delete = "30m"
  }

  enable_autoscaling       = true
  autoscaling_min_capacity = var.autoscaling_min_capacity
  autoscaling_max_capacity = var.autoscaling_max_capacity

  autoscaling_policies = {
    cpu = {
      policy_type = "TargetTrackingScaling"

      target_tracking_scaling_policy_configuration = {
        predefined_metric_specification = {
          predefined_metric_type = "ECSServiceAverageCPUUtilization"
        }
        target_value       = 60
        scale_in_cooldown  = 300
        scale_out_cooldown = 60
      }
    }
  }

  load_balancer = {
    backend = {
      target_group_arn = var.target_group_arn
      container_name   = "backend"
      container_port   = 8080
    }
  }

  # The execution role may read exactly these secrets (module adds GetSecretValue).
  task_exec_secret_arns = compact([
    var.jwt_secret_arn,
    var.db_password_secret_arn,
    var.datadog_api_key_secret_arn,
  ])

  tasks_iam_role_statements = var.enable_datadog ? [
    {
      sid = "DatadogEcsRead"
      actions = [
        "ecs:ListClusters",
        "ecs:ListContainerInstances",
        "ecs:DescribeContainerInstances",
      ]
      resources = ["*"]
    },
  ] : null

  container_definitions = merge(local.backend_container, local.datadog_container)
}
