# AWS Deployment

Terraform for a production deployment: **ECS Fargate** for the backend, **S3 + CloudFront** for the frontend, **RDS Postgres**, all in a single VPC.

## Architecture

```
                 ┌────────────────────┐
Browser ───────▶ │  CloudFront (SPA)  │ ───▶ S3 (static assets, private via OAC)
   │             └────────────────────┘
   │ direct API calls (no CDN in front)
   ▼
┌────────────────────┐        ┌──────────────────────────┐
│  ALB (public subnet)│ ────▶ │ ECS Fargate (private subnet)│ ────▶ RDS Postgres (private subnet)
└────────────────────┘        └──────────────────────────┘
```

### Why the frontend isn't served *through* the backend's CDN path

The SPA is static (HTML/JS/CSS) — S3 + CloudFront serves it without running a container 24/7. CloudFront replaces the role `frontend/nginx.conf` plays in the Docker Compose setup (SPA fallback + static asset caching).

### Why CloudFront does NOT proxy `/api/*` to the backend


- The ALB is **public** and reachable directly (its own DNS name, or a `api.<domain>` record pointed at it).
- The SPA calls the ALB's domain directly for `/api/*` and `/api/licenses/events` (SSE) — no CDN hop.
- `CORS_ORIGIN` on the backend is set to the CloudFront domain so cross-origin requests from the SPA are allowed.

## Modules

| Module | Creates |
|--------|---------|
| `networking` | VPC, public/private subnets, IGW, single NAT gateway, security groups (ALB, ECS, RDS) |
| `database` | RDS Postgres (private, encrypted), credentials + connection string in Secrets Manager |
| `ecr` | ECR repository for the backend image (immutable tags, scan on push, keeps last 10 images) |
| `ecs-backend` | ALB (300s idle timeout for SSE), ECS Fargate service, task definition, autoscaling on CPU, CloudWatch logs |
| `frontend-static` | S3 bucket (private, OAC-only access), CloudFront distribution with SPA fallback (403/404 → index.html) |

## Prerequisites

- Terraform >= 1.5
- An AWS account + credentials configured (`aws configure` or env vars)
- Docker, to build and push the backend image to ECR

## One-time bootstrap: remote state

Terraform state is stored in S3 (with DynamoDB locking) instead of locally, so both your machine and the CI deploy workflow read/write the same state. Create these once, by hand (chicken-and-egg: Terraform can't manage the bucket it stores its own state in):

```bash
aws s3api create-bucket --bucket <your-unique-bucket-name> --region us-east-1
aws s3api put-bucket-versioning --bucket <your-unique-bucket-name> \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Then create `infra/terraform/backend-config.hcl` (gitignored — every environment/developer points at the same bucket, but the file itself isn't committed):

```hcl
bucket         = "<your-unique-bucket-name>"
key            = "music-licensing/production.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
```

## Deploy (local / manual)

```bash
cd infra/terraform
terraform init -backend-config=backend-config.hcl
terraform apply
```

This provisions everything **except** the backend image — ECS will fail to start tasks until an image exists at `backend_ecr_repository_url:latest`. Build and push it:

```bash
# From the output of `terraform apply`:
REPO_URL=$(terraform output -raw backend_ecr_repository_url)

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "${REPO_URL%/*}"

docker build -t "$REPO_URL:latest" ../../backend
docker push "$REPO_URL:latest"

terraform apply
```

`terraform apply` on its own won't detect that a new image was pushed under the same `:latest` tag (Terraform only tracks the tag string, not the image digest), so force ECS to redeploy with the fresh image:

```bash
aws ecs update-service \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --service "$(terraform output -raw ecs_service_name)" \
  --force-new-deployment
```

Then build and upload the frontend, pointing it at the ALB's URL:

```bash
BACKEND_URL=$(terraform output -raw backend_url)
cd ../../frontend
VITE_API_URL="$BACKEND_URL/api" npm run build
aws s3 sync dist/ "s3://$(cd ../infra/terraform && terraform output -raw frontend_bucket_name)" --delete

# Invalidate the CDN cache so the new build is served immediately
aws cloudfront create-invalidation \
  --distribution-id "$(cd ../infra/terraform && terraform output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

## Deploy (CI, manual trigger)

The steps above are automated in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), triggered manually from the GitHub Actions tab (`workflow_dispatch`) — merging to `main` never deploys by itself. See [CI/CD](#cicd) below for setup and how it works.

## Outputs

After `terraform apply`, useful values are available via `terraform output`:

- `frontend_url` — CloudFront URL for the SPA
- `backend_url` — ALB URL for the API
- `backend_ecr_repository_url` — where to push backend images
- `frontend_bucket_name` / `cloudfront_distribution_id` — for frontend deploys
- `ecs_cluster_name` / `ecs_service_name` — for forcing a redeploy
- `database_endpoint` — RDS address (not publicly reachable; for reference/debugging via a bastion or ECS Exec)

## CI/CD

Two workflows, deliberately separated so a failing build/test can never block someone from merging a PR into `main`, and so nothing ever deploys to AWS without an explicit human action:

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | `pull_request` → `main`, `push` → `main` | Backend: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`. Frontend: `npm run lint`, `npm run build`. Terraform: `fmt -check`, `validate`, `tflint`. No deploy. |
| [`deploy.yml`](../.github/workflows/deploy.yml) | `workflow_dispatch` only | Re-runs backend tests as a safety net, then `terraform apply`, builds + pushes the backend image to ECR tagged with the commit SHA, forces an ECS rollout, builds the frontend against the live backend URL, syncs it to S3, and invalidates CloudFront. |

`ci.yml` is meant to be a **required status check** on `main` (Settings → Branches → Branch protection rule → require `Backend (fmt, clippy, test)` and `Frontend (lint, build)` to pass before merging). `deploy.yml` has no relationship to branch protection — it can be run against any branch/commit from the Actions tab, and requires typing `deploy` into the confirmation input to run.

### One-time GitHub setup for `deploy.yml`

1. **AWS OIDC role** (no long-lived AWS keys stored in GitHub): create an IAM OIDC identity provider for `token.actions.githubusercontent.com` and a role trusting it, scoped to this repo. AWS's guide: [Configuring OpenID Connect in Amazon Web Services](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services). Grant the role permissions for ECS, ECR, S3, CloudFront, Secrets Manager, and the Terraform-managed resources (or attach `AdministratorAccess` for a take-home/non-production setup).
2. In the repo, create a **`production` environment** (Settings → Environments) — optionally with required reviewers, so `deploy.yml`'s `environment: production` step needs an approval click before it runs.
3. Add these **repository secrets** (Settings → Secrets and variables → Actions):
   - `AWS_DEPLOY_ROLE_ARN` — the IAM role ARN from step 1
   - `TF_STATE_BUCKET` — the S3 bucket created in the bootstrap step above
   - `TF_STATE_LOCK_TABLE` — `terraform-locks` (or whatever you named it)

### Running a deploy

Actions tab → "Deploy to AWS (production)" → Run workflow → type `deploy` in the confirmation box. The job graph is `guard` (checks the confirmation text) → `test` (backend tests) → `deploy` (apply, build, push, roll out).



## Notes / things intentionally left out for a take-home scope

- **Custom domains + ACM certs**: supported via `frontend_domain_aliases` / `cloudfront_certificate_arn` (CloudFront, must be us-east-1) and `alb_certificate_arn` (ALB, same region as `aws_region`), but left unset by default — without them the ALB serves plain HTTP and CloudFront uses its default `*.cloudfront.net` certificate.
- **Single NAT gateway** (not one per AZ) to keep cost down — acceptable for this workload, would add one per AZ for production HA.
