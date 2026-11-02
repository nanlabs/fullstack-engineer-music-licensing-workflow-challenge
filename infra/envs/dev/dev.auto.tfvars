# dev: one of everything, Spot, no WAF, easy to destroy.
environment = "dev"

vpc_cidr           = "10.10.0.0/16"
single_nat_gateway = true
enable_flow_logs   = false

db_instance_class       = "db.t4g.micro"
multi_az                = false
backup_retention_period = 1
rds_enhanced_monitoring = false

deletion_protection         = false
skip_final_snapshot         = true
apply_immediately           = true
force_destroy               = true
secret_recovery_window_days = 0

task_cpu                 = 256
task_memory              = 512
desired_count            = 1
autoscaling_min_capacity = 1
autoscaling_max_capacity = 2
capacity_provider        = "FARGATE_SPOT"
container_insights       = "enabled"
enable_ecs_exec          = true
log_retention_days       = 7

enable_waf    = false
create_alarms = false
