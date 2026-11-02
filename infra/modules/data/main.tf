# Stateful services: PostgreSQL on RDS, Valkey on ElastiCache Serverless and
# the secrets the backend reads at start-up. Nothing here is reachable from
# outside the VPC.

locals {
  db_name     = "licensing"
  db_username = "licensing"
  db_port     = 5432
}
