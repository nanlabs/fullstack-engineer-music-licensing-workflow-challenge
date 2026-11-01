# Music licensing backend

Rust backend for the ACME BROS PICTURES music licensing workflow. Actix-web 4,
PostgreSQL 17 with sqlx, passwordless multi-tenant IAM, OpenTelemetry export to
Datadog. The licensing domain itself is a scaffold waiting for its first
module; see `../docs/architecture.md` for how to add one and `../docs/iam.md`
for the authentication model.

## Layout

| Path | What |
| --- | --- |
| `crates/kernel` | Typed ids, `Actor`, `AuthContext`, scope matching, pagination |
| `crates/errx` | `AppError` with stable codes, HTTP mapping, `ValidatedJson<T>` |
| `crates/iam` | Tenants, users, roles, invitations, OTP, sessions, passwordless auth |
| `crates/licensing` | Scaffold for movies, scenes, songs, tracks and the license workflow |
| `crates/app` | Composition root: config, container, telemetry, HTTP server (binary `backend`) |
| `migrations/` | SQL migrations applied at startup; `0002` seeds the ACME tenant |

## Quick start with Docker

From the repository root:

```bash
cp .env.example .env
docker compose up --build -d
curl localhost:8080/health
```

The API listens on `localhost:8080`. OTP codes and invitation tokens are
printed to the backend log (`docker compose logs -f backend`) because no
email provider is wired.

## Local development

```bash
docker compose up -d postgres        # from the repository root
cd backend
cargo run                            # reads ../.env
```

Useful checks:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test                                                   # unit tests
DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
  cargo test -- --include-ignored                            # plus database-backed tests
```

The database-backed tests use `#[sqlx::test]`, which creates and drops a
throwaway database per test on the same server.

## Walk through the flow

Seeded accounts: `admin@acme.test` (scope `*`) and `licensing@acme.test`
(role `licensing-manager`), both in tenant `11111111-1111-4111-8111-111111111111`.

```bash
API=http://localhost:8080/api/v1
TENANT=11111111-1111-4111-8111-111111111111

# 1. Ask for a login code (appears in the backend log)
curl -s $API/auth/passwordless/login/initiate -H 'content-type: application/json' \
  -d "{\"email\":\"admin@acme.test\",\"tenant_id\":\"$TENANT\"}"

# 2. Exchange the code for tokens
curl -s $API/auth/passwordless/login/verify -H 'content-type: application/json' \
  -d "{\"email\":\"admin@acme.test\",\"tenant_id\":\"$TENANT\",\"code\":\"123456\"}"
AT=...   # access_token from the response (also set as an HttpOnly cookie)

# 3. Who am I, what can I do
curl -s $API/auth/me -H "authorization: Bearer $AT"
curl -s $API/scopes  -H "authorization: Bearer $AT"

# 4. Invite someone (token appears in the backend log)
curl -s $API/invitations -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"email":"newbie@acme.test","scopes":["movies:read"],"role_id":"33333333-3333-4333-8333-333333333331"}'

# 5. The invitee proves the mailbox and accepts
curl -s $API/auth/passwordless/signup/initiate -H 'content-type: application/json' \
  -d '{"email":"newbie@acme.test","name":"New Person","invitation_token":"<token>"}'
curl -s $API/auth/passwordless/signup/verify -H 'content-type: application/json' \
  -d "{\"email\":\"newbie@acme.test\",\"name\":\"New Person\",\"invitation_token\":\"<token>\",\"tenant_id\":\"$TENANT\",\"code\":\"<code>\"}"

# 6. Then logs in like in steps 1 and 2; /auth/me shows direct + role scopes

# 7. Rotate tokens, then log out
curl -s $API/auth/refresh -H 'content-type: application/json' -d '{"refresh_token":"<refresh>"}'
curl -s -X POST $API/auth/logout -H "authorization: Bearer $AT"
```

Every error has the same shape and a stable code, for example:

```json
{"error":{"code":"OTP_INVALID","kind":"VALIDATION","message":"Invalid or incorrect code","details":{"attempts_remaining":4}}}
```

## Configuration

All settings come from the environment (`.env` is loaded in development).

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test` or `production`; production hides internal error details |
| `HOST` / `PORT` | `0.0.0.0` / `8080` | |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated |
| `SHUTDOWN_TIMEOUT` | `30s` | Grace period for in-flight requests |
| `LOG_FORMAT` | `pretty` | `pretty` or `json` |
| `RUST_LOG` | `info,sqlx=warn,actix_server=warn` | Standard env filter |
| `DATABASE_URL` | required | Compose overrides it to point at the `postgres` service |
| `DATABASE_MAX_CONNECTIONS` / `DATABASE_ACQUIRE_TIMEOUT` | `10` / `5s` | |
| `JWT_*`, `OTP_*`, `SESSION_*`, `INVITATION_TTL`, `COOKIE_*` | see `.env.example` | Documented in `../docs/iam.md` |
| `SERVICE_NAME` | `music-licensing-backend` | Reported as `service.name` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | empty | OTLP gRPC endpoint; empty means stdout logs only |
| `DD_API_KEY`, `DD_SITE`, `DD_ENV`, `DD_HOSTNAME` | | Used by the optional Datadog Agent service |

## Telemetry and Datadog

Every request gets a root span (`POST /api/v1/auth/passwordless/login/verify`
and friends) with method, route, status, client ip and a `request_id` that is
also returned in the `x-request-id` header. Log records emitted while handling
a request carry the trace id.

To ship traces and logs to Datadog, set in `.env`:

```bash
DD_API_KEY=<your key>
DD_SITE=datadoghq.com            # or datadoghq.eu, us5.datadoghq.com, ...
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4317
```

and start the stack with the agent profile:

```bash
docker compose --profile datadog up --build -d
```

The backend shows up in APM as `music-licensing-backend` with `env` and
`version` tags taken from `deployment.environment.name` and `service.version`,
and the logs explorer correlates each record with its trace. Without an
endpoint the service starts the same way and logs to stdout only.

To check the export without a Datadog account, point
`OTEL_EXPORTER_OTLP_ENDPOINT` at any OTLP collector, for example
`otel/opentelemetry-collector` with the `debug` exporter.

## Design notes

- Ports and adapters per module (`mod.rs / port.rs / service.rs / infra/ / api/`).
- Authorization happens in services through `authz::require(ctx, tenant_id, scope)`; repositories always filter by tenant.
- Codes and tokens are stored hashed; comparisons are constant time; refresh tokens rotate and reuse revokes the session.
- Runtime sqlx queries (no compile-time database); migrations run at startup.
- Multi-stage Docker build with cargo-chef; the runtime image is a non-root Debian slim.

## Next steps

1. First licensing module (`movie`) following the guide in `../docs/architecture.md`.
2. License workflow as an explicit state machine with an event log.
3. Real-time updates (SSE) for workflow changes.
4. Email adapter for `OtpNotifier` and `InvitationNotifier`.
5. CI: `cargo fmt --check`, `clippy -D warnings`, `cargo test` with a Postgres service.
