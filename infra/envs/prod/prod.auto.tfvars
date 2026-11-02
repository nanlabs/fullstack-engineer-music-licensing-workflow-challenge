# prod: small production. Multi-AZ database, NAT per AZ, WAF (count mode until
# the log is reviewed), alarms, read-only task filesystem, nothing destroyable
# by accident.
environment = "prod"

vpc_cidr           = "10.20.0.0/16"
single_nat_gateway = false
enable_flow_logs   = true

db_instance_class       = "db.t4g.small"
multi_az                = true
backup_retention_period = 7
rds_enhanced_monitoring = true

deletion_protection         = true
skip_final_snapshot         = false
apply_immediately           = false
force_destroy               = false
secret_recovery_window_days = 7

task_cpu                 = 512
task_memory              = 1024
desired_count            = 2
autoscaling_min_capacity = 2
autoscaling_max_capacity = 6
capacity_provider        = "FARGATE"
container_insights       = "enhanced"
enable_ecs_exec          = false
log_retention_days       = 30

enable_waf    = true
waf_block     = false
create_alarms = true
# alarm_email = "ops@example.com"
