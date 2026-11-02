# Deployment on AWS

How the application runs on AWS and why it is shaped this way. The operating
manual (bootstrap, GitHub setup, runbook, cost) is
[`../infra/README.md`](../infra/README.md); the Terraform lives in
[`../infra`](../infra).

## Shape

```
                 https://dxxxx.cloudfront.net
                            │
            ┌───────────────▼────────────────┐
            │  CloudFront  (+ WAF in prod)   │
            │  /*      → private S3 (OAC)    │  CloudFront Function: SPA rewrite
            │  /api/*  → VPC origin (ALB)    │  CachingDisabled, no compression
            └───────┬───────────────┬────────┘
                    │               │ service-managed ENI
   ┌────────────────▼──┐   ┌────────▼─────────────────────────────────────────┐
   │ S3 web bucket     │   │ VPC 10.x.0.0/16 · 2 AZ · IGW · NAT (1 dev / 2 prod)│
   │ index.html no-cache│  │  private: internal ALB :80 → ECS Fargate ARM64 :8080│
   │ assets immutable  │   │           ElastiCache Serverless Valkey (TLS 6379)│
   └───────────────────┘   │  database: RDS PostgreSQL 18 (Multi-AZ in prod)   │
                           │  public:   NAT gateways only                      │
                           └───────────────────────────────────────────────────┘
   Secrets Manager: db-password, jwt-secret, datadog-api-key (optional)
   SSM Parameter:   /music-licensing/<env>/backend-image-tag
   ECR (bootstrap):  music-licensing/backend · tag = hash of the backend/ tree
   CloudWatch:       logs (7 d dev / 30 d prod), Container Insights, alarms → SNS (prod)
```

One CloudFront distribution is the only public entry point. Its default
behaviour serves the Vite build from a private S3 bucket (origin access
control); `/api/*` goes to an internal application load balancer in the
private subnets through a CloudFront **VPC origin**, and the ALB forwards to
the backend tasks on ECS Fargate. The tasks reach PostgreSQL on RDS and Valkey
on ElastiCache Serverless inside the VPC, and the internet (ECR, Secrets
Manager, CloudWatch, optionally Datadog) through NAT gateways. Nothing has a
public IP address.

Two environments, `dev` and `prod`, are separate Terraform roots with
separate state files in one bucket. They share the account-level pieces made
by `infra/bootstrap` (state bucket, GitHub OIDC roles, the ECR repository, the
SSM parameters that record which image each environment runs, a budget). The
application runs with `APP_ENV=production` in both: what makes `dev` cheaper
is sizing (single NAT, single-AZ `db.t4g.micro`, one Spot task, no WAF, no
alarms), not behaviour.

## Request flow

- **SPA.** `GET /movies/<id>` has no object in S3. A CloudFront Function on
  the viewer request rewrites any path whose last segment has no extension to
  `/index.html`, so client-side routes work on reload and as deep links. The
  classic alternative, a custom error response turning 403/404 into
  `index.html`, is a distribution-wide setting and would also rewrite the JSON
  errors of `/api/*`; it was rejected for that reason. `index.html` and
  `favicon.svg` are uploaded with `Cache-Control: no-cache`, the hashed
  `assets/*` as `immutable`; every deployment invalidates `/*` (one path,
  free) and keeps old assets so a tab holding the previous `index.html` still
  loads.
- **API.** Same origin as the SPA, so the HttpOnly cookies the backend sets
  are first-party cookies: no CORS, no `SameSite=None`, exactly like the nginx
  proxy in the Docker image. The behaviour uses the managed
  `CachingDisabled` and `AllViewerExceptHostHeader` policies (cookies,
  `Last-Event-ID` and every other header reach the backend; the `Host` is the
  ALB's) and disables compression. The ALB listener is plain HTTP: the hop is
  inside the VPC, and an HTTPS listener would need a certificate for a domain
  the project does not have.
- **Server-Sent Events.** CloudFront streams the response; its origin read
  timeout counts the gap between packets, and the backend sends a `: keep-alive`
  comment every 15 s. The VPC origin is configured with a 60 s read timeout
  and 60 s keep-alive, below the ALB idle timeout of 120 s, and without a
  response completion timeout (that one caps the whole response). CloudFront
  talks HTTP/1.1 to the origin and HTTP/2 or HTTP/3 to the browser, which also
  keeps the stream outside the six-connections-per-host limit of HTTP/1.1.
  The backend closes a stream after 15 minutes and the browser reconnects with
  `Last-Event-ID`.

## Components

**Network** (`modules/network`). Two availability zones (the zone id
`use1-az3` is excluded: CloudFront VPC origins do not support it), three
subnet tiers (public for the NAT gateways only; private for the ALB, the tasks
and the cache; database for RDS). The internet gateway is a prerequisite of
VPC origins even though no inbound traffic is routed through it. An S3
gateway endpoint keeps ECR layer pulls off the NAT. Security groups form a
chain: the ALB admits only the managed prefix list
`com.amazonaws.global.cloudfront.origin-facing` (AWS's documented option for
VPC origins; it weighs 55 of the 60 rules a group may hold, so it is that
group's only ingress rule), the tasks admit only the ALB, RDS and the cache
admit only the tasks. Egress is declared explicitly because the provider
removes the implicit allow-all rule.

**Data** (`modules/data`). RDS PostgreSQL 18 (`db.t4g.small` Multi-AZ in prod,
`db.t4g.micro` single-AZ in dev), gp3 20 → 100 GB, encrypted, `rds.force_ssl`
on, Performance Insights, 7-day backups and deletion protection in prod.
ElastiCache Serverless for Valkey 8, capped at 1 GB and 1000 ECPU/s (caps,
not reservations; billing starts at 100 MB). Three secrets: the database
password, the JWT secret and, optionally, the Datadog API key.

**Edge** (`modules/edge`). The web bucket (private, encrypted, bucket policy
restricted to the distribution ARN, with `ListBucket` so a missing chunk is a
404 rather than S3's 403), the internal ALB with its target group (`/health`,
30 s interval, 5 misses), the CloudFront distribution (OAC, VPC origin,
function, a response-headers policy with HSTS, `nosniff`, `DENY` framing and a
referrer policy; no CSP yet because the UI library injects inline styles), and
in prod a WAF web ACL with the IP reputation, common and known-bad-inputs
managed rule groups plus a per-IP rate limit. The managed groups start in
count mode with logging to CloudWatch; they are switched to block after the
log has been reviewed, because the common rule set's body size and XSS rules
can flag legitimate JSON.

**Backend** (`modules/backend`). An ECS cluster with Container Insights and
both Fargate capacity providers; a service of ARM64 tasks (Graviton, which
Fargate Spot also supports) behind the target group, rolling deployments with
the deployment circuit breaker and automatic rollback, CPU target-tracking
autoscaling, CloudWatch logs, and in prod six alarms to an SNS topic. The task
definition carries the whole backend configuration as environment variables
(`APP_ENV=production`, the CloudFront URL as `APP_PUBLIC_URL` and
`CORS_ORIGINS`, `DATABASE_URL` without a password, `REDIS_URL` with the
`rediss://` scheme) and two secrets (`JWT_SECRET`, `PGPASSWORD`). The optional
Datadog agent is a second container in the same task; the backend's OTLP
exporter then points at `localhost:4317`.

## Secrets

RDS can manage its master password in Secrets Manager, but it rotates it every
seven days and ECS injects secrets only when a task starts: after each
rotation the connection pool would fail, `/health` would answer 503 and ECS
would recycle tasks until they picked up the new value. The password is
therefore generated by Terraform (`random_password`) and handed to RDS and to
Secrets Manager through **write-only arguments** (`password_wo`,
`secret_string_wo`): the provider never reads them back, a read-only plan
cannot see them, and rotation is an explicit step (bump `secrets_version`,
replace the generator, restart the tasks). `DATABASE_URL` carries no password;
sqlx reads `PGPASSWORD` from the environment when the URL has none, and the
task gets that variable from the secret. The generated values do exist in the
Terraform state, which is why the state bucket is private, encrypted,
versioned and TLS-only.

## Deployment pipeline

Images are built once from the `backend/` tree and tagged with its hash: a
push that only touches the frontend or the infrastructure neither rebuilds
nor redeploys the backend. `terraform apply` receives the tag; a data source
verifies it exists in ECR before anything changes (a service created with a
missing image stalls: the circuit breaker has no earlier deployment to roll
back to), and the apply waits for the service to reach a steady state so a
rollback fails the job. Only then is the tag written to the SSM parameter the
roots read when no tag is passed, so a plan or apply without a tag keeps the
running image. `dev` deploys on every push to `main`; `prod` deploys the same
image after a reviewer approves the GitHub environment.

GitHub authenticates with OIDC. Pull-request plans assume a read-only role
whose trust policy only accepts the `pull_request` subject; the deploy roles
accept the `environment:dev` and `environment:prod` subjects, which is why
both GitHub environments must restrict deployments to `main`. Pull-request
plans run with `-lock=false`, skip the ECR image check (the image for the
commit does not exist yet) and share only the rendered plan text: the binary
plan embeds the state. All of it stays dormant until the repository variable
`INFRA_ENABLED` is `true`.

## Operations

- Migrations and seeds run at task start on every instance; sqlx takes a
  PostgreSQL advisory lock first, so two tasks booting together do not race.
  The health-check grace period (180 s) covers the first run on an empty
  database.
- `/health` queries the database, so a Multi-AZ failover (60–120 s) would
  mark tasks unhealthy with default settings; the ALB waits five misses
  (150 s) and the container check six (180 s) before anything is replaced.
- ECS Exec is on in `dev` (writable root filesystem) and off in `prod`, where
  the root filesystem is read-only; the two settings are mutually exclusive.
- OTP codes and invitation links are printed to the backend log (the
  notification provider is `console`): log retention is 7 days in `dev` and
  30 in `prod`, and access to the log group should be treated as access to the
  sign-in flow.
- The demo seed (users `admin@acme.test`, `licensing@acme.test`, three
  movies) is part of the migrations and therefore also lands in `prod`.

## Cost

See the table in [`../infra/README.md`](../infra/README.md): roughly 220–240
USD/month for `prod` and 85 for `dev`, dominated by NAT gateways, the
Multi-AZ database and the load balancer. Interface VPC endpoints (ECR, Logs,
Secrets Manager, SSM, two AZs) would cost more than the NAT gateway they
would replace, and the Datadog sidecar needs internet egress anyway.

## Design notes and sources

1. **CloudFront VPC origins** ([AWS docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html)):
   the VPC needs an internet gateway and a free IPv4 address per private
   subnet; the origin's security group admits either the managed prefix list
   (possible before the VPC origin exists) or the service-managed
   `CloudFront-VPCOrigins-Service-SG` (only after); gRPC and Lambda@Edge
   origin triggers are unsupported; `us-east-1` except `use1-az3`; creation
   takes up to 15 minutes.
2. **SSE through CloudFront**: the origin read timeout is the time between
   packets, 30 s by default and 60 s here; `response_completion_timeout`
   would cap the whole response and is left unset. The backend has no
   compression middleware, so the stream is never buffered.
3. **SPA fallback**: `custom_error_response` belongs to the distribution, not
   to a cache behaviour, hence the CloudFront Function (`cloudfront-js-2.0`).
   The function runs before the cache lookup, so the cache key becomes
   `/index.html` and deployments invalidate `/*`.
4. **Secrets**: RDS-managed master passwords rotate every 7 days by default;
   ECS resolves `secrets` at task start only. `password_wo` /
   `password_wo_version` (rds module v7) and `secret_string_wo` /
   `secret_string_wo_version` (AWS provider ≥ 5.91) are write-only. sqlx
   honours `PGPASSWORD` when the URL has no password
   (`sqlx-postgres 0.8.6`, `PgConnectOptions::new_without_pgpass`).
5. **Concurrent start-up**: `sqlx::migrate!` acquires `pg_advisory_lock`
   (`sqlx-postgres-0.8.6/src/migrate.rs`). ECS deployment circuit breaker:
   minimum failure threshold 3 tasks; a first deployment with a missing image
   stalls instead of rolling back, hence the `aws_ecr_image` guard and
   `wait_for_steady_state`.
6. **Health checks**: ECS ignores the Dockerfile `HEALTHCHECK`; the task
   definition `healthCheck` is what counts. Container `interval 30, retries 6,
   startPeriod 180`; target group `interval 30, unhealthy_threshold 5`.
7. **ECS Exec vs read-only root**: the SSM agent writes inside the container,
   so the two cannot be combined. `tmpfs` mounts are supported on Fargate
   since January 2026 but the binary never writes to disk.
8. **ElastiCache Serverless**: TLS always on, cluster-mode semantics behind a
   single endpoint, `SUBSCRIBE`/`PUBLISH` supported (`PSUBSCRIBE` is not and
   is not used), storage cap 1–5000 GB, ECPU cap 1000–15,000,000. The `redis`
   crate (1.8) needs the `tokio-rustls-comp` feature for `rediss://`; it
   trusts the system certificates (`ca-certificates` in the image) and keeps
   `ring` as the single rustls crypto provider because its `rustls` dependency
   has default features off. Valkey Serverless is 33 % cheaper than Redis OSS
   Serverless. Aurora Serverless v2 was rejected: `/health` would never let it
   pause.
9. **RDS PostgreSQL 18 on t4g**: the instance-class support table did not
   list 18 for `db.t4g.*` when this was written; the version is a variable
   and the README shows the `describe-orderable-db-instance-options` check.
   `rds.force_ssl` defaults to on since PostgreSQL 15; `sslmode=require`
   encrypts without verifying the certificate chain (`verify-full` would need
   the RDS bundle in the image).
10. **Fargate**: Graviton on Fargate Spot since September 2024
    ([announcement](https://aws.amazon.com/about-aws/whats-new/2024/09/amazon-ecs-graviton-based-spot-compute-fargate/));
    changing the capacity provider strategy requires `force_new_deployment`.
11. **Pipeline security**: a binary `tfplan` contains the state; GitHub
    environments without a deployment-branch rule let any branch assume the
    environment's role; forks receive no OIDC token; the plan role trusts the
    `pull_request` and `ref:refs/heads/main` subjects only. GitHub's OIDC
    provider no longer needs a thumbprint list.
12. **WAF**: the common rule set's `SizeRestrictions_BODY` (8 KB) and XSS body
    rules can match JSON; count mode first, logging to an `aws-waf-logs-*`
    group (the console samples only 3 h).
13. **Versions** (checked 2026-11-02): Terraform 1.15.3 pinned (1.17.1 is
    current; a state written by a newer Terraform cannot be read by an older
    one), AWS provider 6.71, random 3.9; terraform-aws-modules vpc 6.7.3,
    alb 10.5.1, ecs 7.6.1, rds 7.2.2, cloudfront 6.7.1, elasticache 1.11.2
    (`modules/serverless-cache`). S3 backend with `use_lockfile` (DynamoDB
    locking is deprecated) and a partial configuration for the bucket name.
    `hashicorp/setup-terraform@v3` does not read `.terraform-version`, so a
    step reads it. `aws-actions/configure-aws-credentials@v6`,
    `aws-actions/amazon-ecr-login@v2`, `docker/build-push-action@v6` with
    `provenance: false` (immutable tags), `ubuntu-24.04-arm` runners (free
    for public repositories).
14. **Unchanged**: Docker Compose, the development Makefile targets, the
    `console` notification provider, the seed migrations.

## Intentionally not here yet

- A custom domain with an ACM certificate: HTTPS to the ALB, a modern minimum
  TLS version (the default `*.cloudfront.net` certificate forces `TLSv1`),
  HSTS preload, cookies on a real domain.
- A Content-Security-Policy header, to be tuned with the application running.
- A liveness endpoint that does not touch the database, for the container
  health check.
- Ephemeral `random_password` resources so no secret value is stored in the
  Terraform state.
- A permissions boundary on the deploy roles instead of `AdministratorAccess`.
- ECS blue/green deployments (the module supports them); rolling with the
  circuit breaker was the choice here.
- Separating the demo seed from the schema migrations so `prod` starts empty.
- A cache usage alarm (ElastiCache Serverless metrics) and ALB access logs.
