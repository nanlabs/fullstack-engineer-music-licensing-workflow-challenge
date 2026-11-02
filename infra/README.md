# Infrastructure (AWS, Terraform)

Everything needed to run the music licensing application on AWS: a
CloudFront distribution in front of a private S3 bucket (the SPA) and a
private ALB (the API, through a CloudFront VPC origin), the backend on ECS
Fargate (ARM64), PostgreSQL on RDS, Valkey on ElastiCache Serverless, and the
GitHub Actions workflows that deploy it. The design and the reasons behind it
are in [`../docs/infra.md`](../docs/infra.md); this file is the operating
manual.

The workflows are **disabled by default**: every job that touches AWS is
skipped until the repository variable `INFRA_ENABLED` is set to `true`. Only
`terraform fmt`, `validate` and `tflint` run on every pull request.

```
infra/
  .terraform-version   pinned Terraform version (read by the workflows and the Makefile)
  .tflint.hcl          tflint rules
  bootstrap/           once per account: state bucket, GitHub OIDC roles, ECR, SSM tags, budget
  modules/
    network/           VPC, subnets, NAT, S3 gateway endpoint, security groups
    data/              RDS PostgreSQL, ElastiCache Serverless (Valkey), secrets
    edge/              S3 web bucket, CloudFront (+ VPC origin, function, headers), WAF, internal ALB
    backend/           ECS cluster + service (Fargate ARM64), autoscaling, alarms, Datadog sidecar
  envs/
    dev/               thin root: the four modules + dev.auto.tfvars
    prod/              thin root: the four modules + prod.auto.tfvars
```

## Requirements

- Terraform `1.15.3` (`infra/.terraform-version`; `required_version = "~> 1.15.0"`).
  Keep the same version everywhere: a state written by a newer Terraform
  cannot be read by an older one.
- AWS CLI v2 with an administrator session (`aws login`), region `us-east-1`.
- Optional: `tflint` (`make tf-lint` falls back to the Docker image).

```sh
make tf-fmt        # terraform fmt -recursive infra
make tf-validate   # fmt check + init -backend=false + validate on the three roots (what CI runs)
make tf-lint       # tflint --recursive
make tf-plan ENV=dev   # plan one environment (needs credentials and TF_STATE_BUCKET)
```

## 1. Bootstrap (once per AWS account)

```sh
cd infra/bootstrap
terraform init
terraform apply            # optionally: -var budget_email=you@example.com
```

Creates the state bucket (`music-licensing-tfstate-<account_id>`), the GitHub
OIDC provider and three roles (`gha-plan`, `gha-deploy-dev`,
`gha-deploy-prod`), the ECR repository `music-licensing/backend`, the SSM
parameters `/music-licensing/{dev,prod}/backend-image-tag` and a monthly cost
budget. Then move its own state into the bucket it just created:

```sh
cp backend.tf.example backend.tf     # put the bucket name from `terraform output state_bucket`
terraform init -migrate-state
```

`backend.tf` is ignored by Git (the bucket name carries the account id). Print
the values GitHub needs with `terraform output github_variables`.

Before the first environment apply, confirm that PostgreSQL 18 is orderable on
the chosen instance classes (the RDS support table lagged behind when this was
written). If the query prints nothing, set `pg_version = "17"` and
`pg_family = "postgres17"` in the tfvars.

```sh
aws rds describe-orderable-db-instance-options --engine postgres --engine-version 18 \
  --db-instance-class db.t4g.small \
  --query 'OrderableDBInstanceOptions[].{version:EngineVersion,multiAz:MultiAZCapable}'
```

## 2. GitHub configuration

Settings → Environments:

| Environment | Required reviewers | Deployment branches | Variable |
| --- | --- | --- | --- |
| `dev` | none | **Selected branches: `main`** | `AWS_ROLE_ARN` = `gha-deploy-dev` role ARN |
| `prod` | at least one | **Selected branches: `main`** | `AWS_ROLE_ARN` = `gha-deploy-prod` role ARN |

The deployment-branch restriction matters: without it any branch of the
repository could declare `environment: dev` in a workflow and assume the
administrator role through OIDC. Protect `main` as well (pull requests only).

Settings → Secrets and variables → Actions → **Variables** (repository level):

| Variable | Value |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `TF_STATE_BUCKET` | `state_bucket` output of the bootstrap |
| `ECR_REPOSITORY` | `music-licensing/backend` |
| `AWS_PLAN_ROLE_ARN` | `plan_role_arn` output of the bootstrap |
| `INFRA_ENABLED` | `true` to switch the AWS jobs on (leave unset to keep them skipped) |

No secrets are stored in GitHub: the workflows get short-lived credentials
through OIDC.

## 3. What the workflows do

`infra.yml`

- Every pull request and push touching `infra/**`: `terraform fmt -check`,
  `terraform validate` on the three roots, `tflint`. No credentials.
- Pull requests from this repository (gated by `INFRA_ENABLED`): `terraform
  plan` for `dev` and `prod` with the read-only role, posted as a comment.
  The plan runs with `-lock=false` and never uploads the binary plan (it would
  contain the state). `workflow_dispatch` plans one environment from `main`.

`deploy.yml`: the only path that applies Terraform.

- On every push to `main` that touches `backend/**`, `frontend/**`,
  `infra/**` or the workflow: build the backend image on an ARM runner (the
  tag is the hash of the `backend/` tree, so an unchanged backend is neither
  rebuilt nor redeployed), build the frontend, deploy `dev`, then deploy
  `prod` once a reviewer approves the `prod` environment. Both environments
  receive the same image.
- `terraform apply -var backend_image_tag=<tag>` fails early if the tag does
  not exist in ECR and fails late if ECS rolls the deployment back (circuit
  breaker); only a successful apply records the tag in SSM, so an
  infrastructure-only apply keeps whatever image is running.
- The frontend build goes to S3 (hashed assets as `immutable`, `index.html`
  and `favicon.svg` as `no-cache`) followed by a CloudFront invalidation.
- Manual runs (`workflow_dispatch`): choose the environment, `apply` or
  `destroy`, and optionally an existing image tag to deploy without building.

## 4. Runbook

### First deployment

1. Bootstrap (section 1) and GitHub configuration (section 2) done; merge the
   `infra/` pull request (only `validate` runs).
2. Set `INFRA_ENABLED=true` and run `deploy.yml` manually with
   `environment=dev`, `action=apply`. Expect 20–25 minutes: RDS and CloudFront
   are the slow parts. The distribution keeps deploying for up to 15 minutes
   after the apply returns (`wait_for_deployment = false`).
3. Open the URL: `terraform -chdir=infra/envs/dev output -raw public_url`
   (after `terraform init -backend-config="bucket=$TF_STATE_BUCKET"`).
4. Log in with a seeded account (`admin@acme.test`). The notification
   provider is `console`, so the one-time code is in the backend log:

   ```sh
   aws logs tail "$(terraform -chdir=infra/envs/dev output -raw backend_log_group)" --follow
   ```

5. Smoke test: a deep link such as `/movies/<id>` must render the SPA, the
   API must answer under `/api/v1`, and `/api/v1/events` must stay open past
   60 seconds with `: keep-alive` comments. To exercise the Valkey fan-out,
   scale to two tasks for a moment
   (`aws ecs update-service --cluster <cluster_name> --service <service_name> --desired-count 2`)
   and move a licence while a second browser tab watches.
6. `prod`: push to `main` (or dispatch with `environment=prod`) and approve the
   `prod` environment. WAF starts in count mode; after a look at the log group
   `aws-waf-logs-music-licensing-prod`, set `waf_block = true` in
   `prod.auto.tfvars`.

Manual alternative to step 2: build and push the image yourself, then apply.

```sh
tag=$(git rev-parse HEAD:backend | cut -c1-12)
aws ecr get-login-password | docker login --username AWS --password-stdin <account_id>.dkr.ecr.us-east-1.amazonaws.com
docker buildx build --platform linux/arm64 -t <ecr_repository_url>:$tag --push backend
terraform -chdir=infra/envs/dev apply -var backend_image_tag=$tag
aws ssm put-parameter --name /music-licensing/dev/backend-image-tag --type String --value $tag --overwrite
```

### Everyday

- **Logs**: `aws logs tail "$(terraform output -raw backend_log_group)" --follow`
  (OTP codes and invitation links are printed there: keep the retention short
  and the log group access restricted).
- **A shell in a task (dev only)**: `aws ecs execute-command --cluster
  <cluster_name> --task <task_id> --container backend --interactive --command
  /bin/sh`. Prod runs with a read-only root filesystem and ECS Exec off.
- **Scale**: `desired_count`, `autoscaling_min_capacity` and
  `autoscaling_max_capacity` in the tfvars; the target is 60 % CPU.
- **Database failover (prod)**: Multi-AZ, automatic. The health checks give it
  150 s (ALB) and 180 s (container) before tasks are replaced.
- **Rotate the database password or the JWT secret**: bump `secrets_version`
  in the tfvars and replace the generator, then restart the tasks so they read
  the new value.

  ```sh
  terraform apply -replace=module.data.random_password.db -var secrets_version=2
  aws ecs update-service --cluster <cluster_name> --service <service_name> --force-new-deployment
  ```

  Rotating the JWT secret logs every user out (`-replace=module.data.random_password.jwt`).
- **Datadog**: set `enable_datadog = true` in the tfvars, apply once to create
  the secret, put the key in it, apply again (or force a new deployment):

  ```sh
  aws secretsmanager put-secret-value --secret-id music-licensing/<env>/datadog-api-key --secret-string <api key>
  ```

  The agent runs as a sidecar; the backend ships traces and logs to it over
  OTLP. Raise `task_cpu`/`task_memory` to `512`/`1024` for the extra container.
- **Alarms (prod)**: set `alarm_email` and confirm the SNS subscription from
  the mailbox.

### Teardown

- `deploy.yml` → `workflow_dispatch` → `action=destroy`. For `prod`, first
  set `deletion_protection = false` and `force_destroy = true` in the tfvars
  and apply, then destroy (the environment approval applies). CloudFront and
  the VPC origin take 15–20 minutes to disappear.
- Secrets are scheduled for deletion with a recovery window (`prod`: 7 days);
  to reuse the same names sooner:
  `aws secretsmanager delete-secret --secret-id <name> --force-delete-without-recovery`.
- Last, `terraform destroy` in `infra/bootstrap` (the state bucket keeps its
  objects unless emptied first; the ECR repository needs
  `-var ecr_force_delete=true` while it holds images).

## Cost (us-east-1, approximate, idle)

| | prod | dev |
| --- | --- | --- |
| Fargate ARM64 | 2 × (0.5 vCPU, 1 GB) ≈ 30 | 1 × (0.25 vCPU, 0.5 GB) Spot ≈ 3 |
| Internal ALB | ≈ 20 | ≈ 18 |
| NAT gateways (+ public IPv4) | 2 × ≈ 37 = 74 | ≈ 37 |
| RDS PostgreSQL | `db.t4g.small` Multi-AZ, 20 GB gp3 ≈ 55 | `db.t4g.micro`, 20 GB ≈ 14 |
| ElastiCache Serverless Valkey | ≈ 6–10 | ≈ 6 |
| CloudFront + WAF | ≈ 13 | ≈ 1 |
| CloudWatch, Secrets Manager, ECR, SSM | ≈ 25 | ≈ 4 |
| **Total** | **≈ 220–240 USD/month** | **≈ 85 USD/month** |

The bootstrap budget alerts at 80 % and 100 % of 350 USD/month for the
account. The NAT gateways are the largest fixed cost; they are what keeps
every component without a public IP.
