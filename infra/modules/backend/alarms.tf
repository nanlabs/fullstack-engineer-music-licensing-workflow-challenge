# CloudWatch alarms to an SNS topic (prod). The e-mail subscription must be
# confirmed from the mailbox before it delivers anything.

resource "aws_sns_topic" "alarms" {
  count = var.create_alarms ? 1 : 0

  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count = var.create_alarms && var.alarm_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarm_actions = var.create_alarms ? [aws_sns_topic.alarms[0].arn] : []
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-alb-target-5xx"
  alarm_description   = "Backend answered 5xx more than 20 times in 5 minutes"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 20
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-alb-unhealthy-hosts"
  alarm_description   = "At least one backend task failed the ALB health check for 3 minutes"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-ecs-cpu-high"
  alarm_description   = "Backend service CPU above 80 % for 15 minutes (autoscaling targets 60 %)"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = module.cluster.name
    ServiceName = module.service.name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-cpu-high"
  alarm_description   = "Database CPU above 80 % for 15 minutes"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.database_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-free-storage-low"
  alarm_description   = "Database free storage below 2 GiB (storage autoscaling should kick in first)"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2147483648
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.database_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-connections-high"
  alarm_description   = "More than 60 database connections (each task holds at most DATABASE_MAX_CONNECTIONS)"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 60
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.database_identifier
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}
