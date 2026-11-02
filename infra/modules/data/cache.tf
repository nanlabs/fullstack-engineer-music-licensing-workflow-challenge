# ElastiCache Serverless for Valkey: TLS is always on, billing starts at
# 100 MB. The backend only uses PUBLISH/SUBSCRIBE on one channel to fan out
# licence events between tasks, so the limits below are caps, not reservations.

module "valkey" {
  source  = "terraform-aws-modules/elasticache/aws//modules/serverless-cache"
  version = "~> 1.11"

  cache_name           = "${var.name}-valkey"
  description          = "License event fan-out between backend tasks"
  engine               = "valkey"
  major_engine_version = "8"

  cache_usage_limits = {
    data_storage = {
      maximum = var.cache_max_storage_gb
      unit    = "GB"
    }
    ecpu_per_second = {
      maximum = var.cache_max_ecpu_per_second
    }
  }

  security_group_ids = [var.cache_security_group_id]
  subnet_ids         = var.private_subnet_ids
}
