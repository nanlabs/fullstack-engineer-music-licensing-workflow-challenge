# Backend

Rust REST API for the music licensing workflow platform. Built with Actix-web, SQLx, and PostgreSQL.

## Architecture

Hexagonal / ports-and-adapters: each domain module follows **model** → **port** (trait) → **service** (business logic) → **api** (HTTP handlers) → **adapter** (Postgres).

```
src/
├── iam/               # Auth (JWT + refresh tokens), RBAC, users, roles
│   ├── auth/          # Login, register, token refresh, sessions
│   ├── user/          # User CRUD
│   ├── role/          # Role + scope management
│   └── scopes/        # Scope constants and role→scope mapping
├── movie/             # Movies + team membership (Owner/Supervisor/Editor/Viewer)
├── scene/             # Scenes (timecoded segments within movies)
├── song/              # Song catalog, artist + label association
├── track/             # Song placements in scenes (usage type, time range)
├── label/             # Labels + member management (Owner/Rep/Artist)
├── license/           # License requests, offers, negotiation state machine, SSE
├── kernel/            # Shared types: typed IDs, pagination
├── error/             # Structured error responses (code, type, details)
├── openapi.rs         # utoipa OpenAPI spec generation
└── main.rs            # Server bootstrap, config, migrations
```

Each module exposes:

| File | Purpose |
|---|---|
| `model.rs` | Domain types, request/response DTOs, validation |
| `port.rs` | Repository trait (interface) |
| `service.rs` | Business logic + unit tests |
| `api.rs` | Actix-web handlers + route registration |
| `error.rs` | Module-specific error variants |
| `adapter.rs` | SQLx Postgres implementation of the port |
| `container.rs` | Dependency injection (wires adapter → service → api) |

## Environment Variables

The backend reads configuration from process environment variables. It does **not** auto-load a `.env` file — either export them in your shell, or run via Docker Compose (which injects them from the root `.env`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | no | `postgres://postgres:postgres@127.0.0.1:5432/music_licensing` | Postgres connection string |
| `DB_MAX_CONNECTIONS` | no | `10` | Connection pool size |
| `JWT_SECRET` | no | `dev-secret-key-change-in-production-must-be-32-chars` | HMAC signing secret for JWTs. **Must be changed in production.** Logs a warning if using the default. |
| `ACCESS_TOKEN_TTL_SECS` | no | `900` (15 min) | Access token lifetime |
| `REFRESH_TOKEN_TTL_SECS` | no | `604800` (7 days) | Refresh token lifetime |
| `BIND_ADDR` | no | `0.0.0.0:8080` | Listen address |
| `WORKERS` | no | `0` (= one per CPU core) | Actix-web worker threads |
| `CORS_ORIGIN` | no | *(empty = any origin)* | Restrict CORS to a single origin. Empty or `*` allows all. |
| `RUST_LOG` | no | actix default | Log filter, e.g. `info`, `backend=debug,actix_web=info` |

## Running

### Via Docker Compose (recommended)

From the repo root:

```bash
cp .env.example .env
docker compose up --build
```

Migrations run automatically on startup. Backend is at `http://localhost:8080`.

### Locally (without Docker)

You need a running Postgres. Start one quickly with:

```bash
make db-up   # or: docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=music_licensing -p 5432:5432 postgres:16-alpine
```

Then:

```bash
# Option 1: source the root .env and run
set -a && source ../.env && set +a
make run

# Option 2: export DATABASE_URL directly
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/music_licensing
cargo run
```

## Testing

547 tests total, all against real PostgreSQL via [Testcontainers](https://testcontainers.com/) (Docker must be running):

```bash
make test            # all tests
make test-verbose    # with stdout shown
cargo test --test license_tests    # specific test file
```

| Level | Count | Description |
|---|---|---|
| Service unit tests (`src/*/service.rs`) | 215 | Business logic, authorization, state transitions |
| Integration tests (`tests/*_tests.rs`) | 248 | Service + Postgres adapter end-to-end |
| API e2e tests (`tests/*_api_tests.rs`) | 84 | Full HTTP: mount Actix app, send requests, assert status codes + response bodies |

Test breakdown by module:

| Module | Service | Integration | API | Total |
|---|---|---|---|---|
| license | 39 | 46 | 28 | 113 |
| movie | 30 | 31 | 14 | 75 |
| song | 22 | 35 | 11 | 68 |
| label | 20 | 26 | 13 | 59 |
| track | 27 | 22 | 9 | 58 |
| scene | 22 | 19 | 9 | 50 |
| auth | 14 | 25 | 10 | 49 |
| user | 21 | 15 | — | 36 |
| role | 20 | 19 | — | 39 |

## API Documentation

Swagger UI is served at `/docs` when the server is running, with the raw OpenAPI spec at `/api-docs/openapi.json`.

A complete curl walkthrough of every flow (multi-user, full negotiation cycle) is in [`docs/api-flows.md`](docs/api-flows.md).

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login, returns access + refresh tokens |
| `POST` | `/api/auth/refresh` | Refresh an access token |
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/movies` | Create a movie |
| `GET` | `/api/movies/me` | List caller's movies |
| `POST` | `/api/scenes` | Create a scene in a movie |
| `POST` | `/api/tracks` | Place a song in a scene |
| `POST` | `/api/songs` | Add a song to the catalog |
| `POST` | `/api/licenses` | Create a draft license request |
| `POST` | `/api/licenses/{id}/submit` | Submit draft for review |
| `POST` | `/api/licenses/{id}/counter` | Counter-offer |
| `POST` | `/api/licenses/{id}/accept` | Accept the current offer |
| `POST` | `/api/licenses/{id}/reject` | Reject with reason |
| `GET` | `/api/licenses/events` | SSE stream of license events |

55 endpoints total — see Swagger UI for the complete list.

## Makefile

```
make run           cargo run
make build         cargo build
make test          cargo test (all tests, needs Docker for testcontainers)
make fmt           cargo fmt
make clippy        cargo clippy --all-targets -- -D warnings
make check         fmt-check + clippy + test
make watch         cargo watch -x run (requires cargo-watch)
make db-up         start Postgres via docker compose
make docker-build  build the backend Docker image
make clean         cargo clean
```
