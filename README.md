# Music Licensing Workflow

Full-stack application for managing music licensing negotiations between movie production teams and rights holders (labels and independent artists).

Movie teams place songs into scenes, submit license requests, and negotiate terms (fee, territory, media rights, exclusivity) through a structured offer/counter-offer workflow. Rights holders review incoming requests and respond in real time via Server-Sent Events.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
  - [Backend — Hexagonal Architecture](#backend--hexagonal-architecture)
  - [Frontend — Dual Workspace](#frontend--dual-workspace)
- [Data Model](#data-model)
- [Real-Time: Server-Sent Events](#real-time-server-sent-events)
- [API](#api)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Development (without Docker)](#development-without-docker)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
  - [Cloud Architecture (AWS)](#cloud-architecture-aws)
  - [CI/CD](#cicd)
- [Tech Decisions](#tech-decisions)

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/api |
| Swagger UI | http://localhost:8080/docs |

Six demo accounts are seeded automatically (password: `abraxas12345`):

| Email | Role | Persona |
|---|---|---|
| `casey@studio.dev` | Producer | Movie supervisor / owner |
| `jordan@studio.dev` | Producer | Movie team member |
| `nova@indie.dev` | Artist | Independent song creator |
| `priya@wavelabel.dev` | Label Manager | Wave Records owner |
| `mateo@wavelabel.dev` | Label Manager | Wave Records rep |
| `sam@studio.dev` | Admin | Platform administrator |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker Compose                         │
│                                                              │
│  ┌────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │  Frontend   │   │     Backend      │   │   Postgres   │  │
│  │  React SPA  │──▶│   Rust / Actix   │──▶│    16-alpine  │  │
│  │  Nginx :80  │   │   REST + SSE     │   │     :5432    │  │
│  └────────────┘   └──────────────────┘   └──────────────┘  │
│     :3000              :8080                  :5432          │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Stack |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind v4, shadcn/ui |
| **Backend** | Rust, Actix-web, SQLx, PostgreSQL, JWT auth, SSE |
| **Infra** | Docker Compose (dev), Terraform + AWS ECS Fargate (prod) |

### Backend — Hexagonal Architecture

Each domain module follows the same structure: **model** (domain types) → **port** (trait/interface) → **service** (business logic) → **api** (HTTP handlers) → **adapter** (Postgres implementation).

| Module | Responsibility |
|---|---|
| `iam` | Authentication (JWT + refresh tokens), authorization (scope-based RBAC), user management |
| `movie` | Movies and movie team membership (Owner / Supervisor / Editor / Viewer) |
| `scene` | Scenes within movies (timecoded segments) |
| `song` | Song catalog, artist and label association |
| `track` | Song placements within scenes (usage type, time range) |
| `label` | Labels, label membership (Owner / Rep / Artist) |
| `license` | License requests, offer/counter-offer negotiation, SSE event streaming |
| `kernel` | Shared types (typed IDs, pagination) |
| `error` | Structured error responses with codes, types, and detail maps |

### Frontend — Dual Workspace

**Studio Workspace** (movie production team):
- Movie management with search and team member roles
- Scene detail with track placements and song search
- License request creation, submission, counter-offer, and status tracking

**Rights Holder Workspace** (labels and independent artists):
- Song catalog management and placement tracking
- License inbox with status filters (needs response, approved, rejected)
- Negotiation: accept, counter-offer, reject with reason
- Label member management with role assignment

Both workspaces share: real-time SSE notifications, responsive layout (mobile drawer / desktop sidebar), dark/light theme, notification bell, and workspace switcher.

## Data Model

```
users ──┬── user_roles ──── roles (Admin, Producer, Artist, Label Manager)
        ├── movie_members ── movies ── scenes ── tracks ── license_requests ── license_offers
        └── label_members ── labels ── songs ─────────────────┘
```

- A **movie** has **scenes** (timecoded segments), each with **track** placements
- A **track** links a **song** to a scene with usage type and time range
- Each track can have one **license request**: `DRAFT → REQUESTED → APPROVED / REJECTED / CANCELLED`
- Negotiation happens through **license offers** — each side proposes terms until one accepts or rejects
- **Songs** belong to an **artist** and optionally a **label**
- Rights holder resolution: label Owner/Rep if the song has a label, otherwise the artist directly

## Real-Time: Server-Sent Events

SSE is implemented end-to-end:

- **Backend:** `GET /api/licenses/events` streams `LicenseEvent` payloads (`submitted`, `counter_offer`, `accepted`, `rejected`, `cancelled`) via `tokio::sync::broadcast`
- **Frontend:** `EventSource` subscribes on mount, triggers toast notifications and UI updates on each event
- **Compression fix:** `Content-Encoding: identity` header prevents gzip buffering from delaying SSE delivery

## API

55 REST endpoints documented with OpenAPI (utoipa). Full interactive docs at `/docs` when the server is running.

```bash
# Login (seeded demo account)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "casey@studio.dev", "password": "abraxas12345"}'
# → { "access_token": "eyJ...", "refresh_token": "..." }

# Create a movie
curl -X POST http://localhost:8080/api/movies \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"title": "Midnight Symphony", "director": "Casey Reyes", "release_year": 2027}'

# Listen for license events (SSE)
curl -N http://localhost:8080/api/licenses/events -H "Authorization: Bearer eyJ..."
```

A complete multi-user curl walkthrough (login as each persona, create resources, negotiate a license end-to-end) is available in [`backend/docs/api-flows.md`](backend/docs/api-flows.md).

### Error Responses

```json
{
  "code": "license.conflict",
  "message": "A license request already exists for this track",
  "error_type": "CONFLICT",
  "details": { "track_id": "abc-123" }
}
```

Internal errors are redacted from clients (generic message, details stripped) while logged in full server-side.

## Testing

547 tests across three levels — all using real PostgreSQL via [Testcontainers](https://testcontainers.com/) (no mocks, no SQLite):

```bash
cd backend && make test
```

| Level | Files | Tests | What it covers |
|---|---|---|---|
| Service unit | 9 `src/*/service.rs` | 215 | Business logic, state transitions, authorization rules |
| Integration | 10 `tests/*_tests.rs` | 248 | Full service + Postgres adapter against real DB |
| API (e2e) | 6 `tests/*_api_tests.rs` | 84 | HTTP-level: status codes, response shapes, auth enforcement |

## Environment Variables

All variables have sensible defaults for local development. See [`.env.example`](.env.example).

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/music_licensing` | Postgres connection string |
| `JWT_SECRET` | dev default (insecure) | HMAC signing key for JWTs — **set in production** |
| `RUST_LOG` | `info` | Backend log level |
| `CORS_ORIGIN` | `*` (any origin) | Allowed CORS origin |
| `BIND_ADDR` | `0.0.0.0:8080` | Backend listen address |
| `DB_MAX_CONNECTIONS` | `10` | Postgres connection pool size |
| `ACCESS_TOKEN_TTL_SECS` | `900` | Access token lifetime (seconds) |
| `REFRESH_TOKEN_TTL_SECS` | `604800` | Refresh token lifetime (seconds) |
| `VITE_USE_MOCK_API` | `false` | Set `true` to build frontend against the in-memory mock API |

Full backend variable reference: [`backend/README.md`](backend/README.md).

## Development (without Docker)

```bash
# 1. Start Postgres
docker run -d --name music-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=music_licensing \
  -p 5432:5432 postgres:16-alpine

# 2. Backend (Terminal 1)
cd backend && cargo run

# 3. Frontend (Terminal 2)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

Or use the Makefile shortcuts: `make backend-run`, `make frontend-dev`.

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── iam/           # Auth, users, roles, sessions
│   │   ├── movie/         # Movies, members
│   │   ├── scene/         # Scenes
│   │   ├── song/          # Songs
│   │   ├── track/         # Track placements
│   │   ├── label/         # Labels, members
│   │   ├── license/       # License requests, offers, SSE
│   │   ├── kernel/        # Shared types
│   │   ├── error/         # Error handling
│   │   ├── openapi.rs     # OpenAPI spec
│   │   └── main.rs        # Server bootstrap
│   ├── migrations/        # SQL migrations (auto-run on startup)
│   ├── tests/             # Integration + API tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/           # API client layer
│   │   ├── components/    # UI components + shadcn/ui primitives
│   │   ├── lib/           # Hooks, auth, utilities
│   │   ├── pages/
│   │   │   ├── studio/    # Movie team workspace
│   │   │   └── rights/    # Rights holder workspace
│   │   └── App.tsx        # Router
│   ├── Dockerfile
│   └── nginx.conf
├── infra/
│   └── terraform/         # AWS ECS + S3/CloudFront + RDS
├── compose.yml
├── Makefile
└── .env.example
```

## Deployment

### Cloud Architecture (AWS)

```
                          ┌──────────────────────────────────┐
                          │            Route 53               │
                          │   app.example.com  api.example.com│
                          └──────┬──────────────────┬────────┘
                                 │                  │
                   ┌─────────────▼──────┐  ┌───────▼──────────────┐
                   │  CloudFront (CDN)   │  │   ALB (public subnet) │
                   │  S3 origin (OAC)    │  │   300s idle timeout   │
                   │  SPA fallback       │  │   (SSE-friendly)      │
                   └─────────────────────┘  └───────┬──────────────┘
                                                    │
                          ┌─────────── VPC ─────────┼──────────────┐
                          │                         │              │
                          │              ┌──────────▼───────────┐  │
                          │              │  ECS Fargate          │  │
                          │              │  (private subnet)     │  │
                          │              │  Rust backend          │  │
                          │              │  autoscaling on CPU    │  │
                          │              └──────────┬───────────┘  │
                          │                         │              │
                          │              ┌──────────▼───────────┐  │
                          │              │  RDS PostgreSQL       │  │
                          │              │  (private subnet)     │  │
                          │              │  encrypted, no public │  │
                          │              └──────────────────────┘  │
                          │                                        │
                          │  NAT GW (public) ← ECS outbound        │
                          └────────────────────────────────────────┘
```

**Key design choices:**

- **Frontend** is pure static files (S3 + CloudFront) — no container needed, global CDN caching, SPA fallback via custom error responses (403/404 → `index.html`)
- **API calls go directly to the ALB**, not through CloudFront — avoids CDN caching issues with authenticated/dynamic responses and keeps SSE connections clean (ALB idle timeout is set to 300s for long-lived SSE streams; the backend sends a `: keepalive` comment every 30s to prevent idle disconnects)
- **Cross-origin**: frontend on `app.example.com`, backend on `api.example.com` — `CORS_ORIGIN` is set to the CloudFront domain, and `VITE_API_URL` is set at frontend build time to point at the ALB
- **RDS + ECS in private subnets** — only the ALB is internet-facing; backend reaches the internet via a NAT gateway (for ECR image pulls, etc.)
- **Secrets**: DB credentials stored in AWS Secrets Manager, injected into ECS task definition as environment variables

### CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | PR to `main`, push to `main` | Lint, typecheck, test (backend + frontend + Terraform validate). No deploy. |
| [`deploy.yml`](.github/workflows/deploy.yml) | Manual (`workflow_dispatch`) | Runs tests → `terraform apply` → builds + pushes backend image to ECR → forces ECS rollout → builds frontend with `VITE_API_URL` → syncs to S3 → invalidates CloudFront cache |

Deploy is **never automatic** — merging to `main` runs CI only. Deployment requires manually triggering the workflow and typing `deploy` as confirmation.

See [`infra/README.md`](infra/README.md) for Terraform module breakdown, prerequisites, bootstrap steps, and one-time GitHub/AWS setup.

## Tech Decisions

| Decision | Rationale |
|---|---|
| **REST over GraphQL** | Clear resource hierarchy (movies → scenes → tracks → licenses → offers) maps naturally to REST. Negotiation actions (submit, counter, accept, reject) are better as dedicated endpoints than generic mutations. |
| **SSE over WebSockets** | License events are server-to-client only. SSE is simpler (no handshake, automatic reconnection via `EventSource`), works through HTTP/2, and needs no extra infrastructure. |
| **Rust + Actix-web** | Compile-time SQL validation (SQLx), exhaustive pattern matching on the license state machine, and zero-cost SSE streaming. The domain is inherently stateful — Rust's type system prevents invalid state transitions at compile time. |
| **Testcontainers** | Every test runs against real PostgreSQL — no mocks, no SQLite. Catches real SQL bugs and constraint violations that in-memory fakes would miss. |

## License

[MIT](LICENSE)
