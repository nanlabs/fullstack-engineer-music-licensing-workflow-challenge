# Music licensing backend

Rust backend for the ACME BROS PICTURES music licensing workflow. Actix-web 4,
PostgreSQL 17 with sqlx, passwordless multi-tenant IAM, Server-Sent Events
with Redis fan-out for live licensing status, OpenTelemetry export to Datadog.
See `../docs/architecture.md` for the module shape, `../docs/licensing.md` for
the domain and the research behind it, and `../docs/iam.md` for the
authentication model.

## Layout

| Path               | What                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/kernel`    | Typed ids, `Actor`, `AuthContext`, scope matching, pagination                                                                                                                                                             |
| `crates/errx`      | `AppError` with stable codes, HTTP mapping, `ValidatedJson<T>`                                                                                                                                                            |
| `crates/iam`       | Tenants, users, roles, invitations, OTP, sessions, passwordless auth                                                                                                                                                      |
| `crates/licensing` | Licensing domain: `movie`, `scene`, `song`, `track`, the `license` workflow (state machine, event log, expiry sweep) and `events` (the SSE stream, in-process bus, Redis adapter)                                         |
| `crates/notifx`    | Notification delivery: `Email`, the `EmailSender` port, the console sender and the adapters for the IAM notifier ports                                                                                                    |
| `crates/app`       | Composition root: config, container, telemetry, HTTP server (binary `backend`)                                                                                                                                            |
| `migrations/`      | SQL migrations applied at startup; `0002` seeds the ACME tenant, `0004` three movies, `0006` their scenes, `0008` four songs, `0010` four tracks, `0012` their licenses; `0013` numbers the license events for the stream |

## Quick start with Docker

From the repository root:

```bash
cp .env.example .env
docker compose up --build -d
curl localhost:8080/health
```

That starts PostgreSQL, Redis, the backend and the frontend. The API
listens on `localhost:8080` and the web client on `http://localhost:5173`
(see `../frontend/README.md`). OTP codes and invitations are printed to the backend log as
fully rendered emails (`docker compose logs -f backend`) because no email
provider is wired; see `../docs/notifications.md`.

The `Makefile` at the repository root wraps the same commands: `make up`
creates `.env` from the example when missing, builds the image and waits
until the backend is healthy; `make logs`, `make down` and `make reset`
(drop the volumes and start again from the seed) do what they say. `make`
alone lists every target.

## Local development

```bash
docker compose up -d postgres redis  # from the repository root
cd backend
cargo run                            # reads ../.env
```

Or `make dev` from the root, which does both. `make check`, `make test` and
`make test-all` run what CI runs (the last one starts Postgres and Redis
first).

Without `REDIS_URL` the backend runs with an in-process event bus, which is
enough for one instance; set it (`redis://localhost:6379`) to fan license
events out across several.

The compiler is pinned: `rust-toolchain.toml` selects `1.95.0` (rustup
installs it on first use), `rust-version` in `Cargo.toml` declares the same
version, and CI and the Docker image build with it and with `--locked`. Bump
the four places together (`../docs/architecture.md`, "Toolchain").

Useful checks:

```bash
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked                                          # unit tests
DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
REDIS_URL=redis://localhost:6379 \
  cargo test -- --include-ignored                            # plus database- and Redis-backed tests
```

The database-backed tests use `#[sqlx::test]`, which creates and drops a
throwaway database per test on the same server; the Redis round-trip test
only needs a server to talk to.

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

# 4. Invite someone. The backend log prints the invitation email with the link
#    http://localhost:5173/accept-invitation#token=<token>
curl -s $API/invitations -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"email":"newbie@acme.test","scopes":["movies:read"],"role_id":"33333333-3333-4333-8333-333333333331"}'
curl -s "$API/invitations?status=pending" -H "authorization: Bearer $AT"

# 5. The invitee previews the invitation (what the acceptance page shows),
#    proves the mailbox and accepts
curl -s $API/auth/passwordless/signup/invitation -H 'content-type: application/json' \
  -d '{"invitation_token":"<token>"}'
curl -s $API/auth/passwordless/signup/initiate -H 'content-type: application/json' \
  -d '{"email":"newbie@acme.test","name":"New Person","invitation_token":"<token>"}'
curl -s $API/auth/passwordless/signup/verify -H 'content-type: application/json' \
  -d "{\"email\":\"newbie@acme.test\",\"name\":\"New Person\",\"invitation_token\":\"<token>\",\"tenant_id\":\"$TENANT\",\"code\":\"<code>\"}"

# 6. Then logs in like in steps 1 and 2; /auth/me shows direct + role scopes

# 7. Movies: the seeded catalogue, search, create and update
curl -s "$API/movies" -H "authorization: Bearer $AT"
curl -s "$API/movies?q=encore&status=in_production" -H "authorization: Bearer $AT"
curl -s $API/movies -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"title":"Neon Tide","release_year":2027,"status":"in_production"}'
curl -s -X PUT $API/movies/<id> -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"status":"released"}'

# 8. Scenes: ordered under their movie, items flat, reorder with the full id list
MOVIE=44444444-4444-4444-8444-444444444441
curl -s "$API/movies/$MOVIE/scenes" -H "authorization: Bearer $AT"
curl -s "$API/movies/$MOVIE/scenes" -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"title":"Encore","start_ms":5400000,"end_ms":5700000}'
curl -s -X PUT $API/scenes/<id> -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"description":"The crowd will not leave.","start_ms":null,"end_ms":null}'
curl -s -X PUT "$API/movies/$MOVIE/scenes/order" -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"scene_ids":["<id>","55555555-5555-4555-8555-555555555553","55555555-5555-4555-8555-555555555552","55555555-5555-4555-8555-555555555551"]}'

# 9. Songs: the tenant catalogue, searched by title or artist, identifiers normalized
curl -s "$API/songs?q=marrow" -H "authorization: Bearer $AT"
curl -s $API/songs -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"title":"Neon Tide","artist":"Ines Calder","isrc":"gb-aaa-24-00001","iswc":"T-034.524.680-1","rights_holder":"Harbor Lane Records","rights_holder_kind":"label","rights_holder_email":"licensing@harborlane.test"}'
curl -s -X PUT $API/songs/<id> -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"album":"","duration_ms":null,"notes":"Clean edit available"}'

# 10. Tracks: cues inside scenes, listed per scene and per movie, song summary embedded
SCENE=55555555-5555-4555-8555-555555555552
curl -s "$API/scenes/$SCENE/tracks" -H "authorization: Bearer $AT"
curl -s "$API/movies/$MOVIE/tracks" -H "authorization: Bearer $AT"
curl -s "$API/scenes/$SCENE/tracks" -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"song_id":"66666666-6666-4666-8666-666666666662","start_ms":500000,"end_ms":560000,"usage":"background"}'
curl -s -X PUT $API/tracks/<id> -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"end_ms":580000,"usage":"featured"}'
# Outside the scene window (7:00 - 10:00) -> 400 naming the field; a placed song -> 409 SONG_IN_USE
curl -s -X DELETE $API/songs/66666666-6666-4666-8666-666666666661 -H "authorization: Bearer $AT"
# A cue whose license is requested, negotiating or approved is frozen: changing its song, timing
# or usage, or deleting it -> 409 TRACK_LOCKED_BY_LICENSE (reject or expire the license first);
# deleting its scene or movie -> 409 SCENE_HAS_ACTIVE_LICENSES / MOVIE_HAS_ACTIVE_LICENSES with the ids
curl -s -X PUT $API/tracks/77777777-7777-4777-8777-777777777771 -H "authorization: Bearer $AT" \
  -H 'content-type: application/json' -d '{"usage":"featured"}'    # "Opening", seeded as approved
curl -s -X DELETE $API/movies/$MOVIE -H "authorization: Bearer $AT"

# 11. License workflow: one POST per event, the history, and ?state= on the lists
TRACK=77777777-7777-4777-8777-777777777773            # "Final bow", seeded as pending
curl -s "$API/movies/$MOVIE/tracks?state=approved" -H "authorization: Bearer $AT"
curl -s -X POST $API/tracks/$TRACK/license/request -H "authorization: Bearer $AT" -H 'content-type: application/json' -d '{}'
# approve from "requested" -> 422 LICENSE_INVALID_TRANSITION with allowed_events
curl -s -X POST $API/tracks/$TRACK/license/approve -H "authorization: Bearer $AT" -H 'content-type: application/json' -d '{}'
curl -s -X POST $API/tracks/$TRACK/license/start_negotiation -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"note":"Harbor Lane quoted; asking for a lower fee on the reprise."}'
curl -s -X POST $API/tracks/$TRACK/license/approve -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d '{"expires_at":"2031-06-30T00:00:00Z","note":"Five years, worldwide, all media.","expected_state":"negotiating"}'
curl -s $API/tracks/$TRACK/license/events -H "authorization: Bearer $AT"

# 12. Watch licensing changes live (Server-Sent Events). Keep this running in
# a second terminal, then move a license in the first one: every transition
# arrives as `event: license.changed` with an `id` and the full track.
curl -N $API/events -H "authorization: Bearer $AT"
curl -N $API/events -b "access_token=$AT"                  # what a browser does: the cookie
curl -N $API/events -H "authorization: Bearer $AT" -H "last-event-id: 9"   # replay everything after event 9

# 13. Rotate tokens, then log out. A refresh token works once: presenting it again,
# or twice at the same time, is treated as a leak and revokes the whole session.
curl -s $API/auth/refresh -H 'content-type: application/json' -d '{"refresh_token":"<refresh>"}'
curl -s -X POST $API/auth/logout -H "authorization: Bearer $AT"
```

Every error has the same shape and a stable code, for example:

```json
{
  "error": {
    "code": "OTP_INVALID",
    "kind": "VALIDATION",
    "message": "Invalid or incorrect code",
    "details": { "attempts_remaining": 4 }
  }
}
```

## Configuration

All settings come from the environment (`.env` is loaded in development).

| Variable                                                    | Default                                              | Notes                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                   | `development`                                        | `development`, `test` or `production`; production hides internal error details                                          |
| `HOST` / `PORT`                                             | `0.0.0.0` / `8080`                                   |                                                                                                                         |
| `CORS_ORIGINS`                                              | `http://localhost:5173`                              | Comma-separated                                                                                                         |
| `SHUTDOWN_TIMEOUT`                                          | `30s`                                                | Grace period for in-flight requests                                                                                     |
| `LOG_FORMAT`                                                | `pretty`                                             | `pretty` or `json`                                                                                                      |
| `RUST_LOG`                                                  | `info,sqlx=warn,actix_server=warn`                   | Standard env filter                                                                                                     |
| `DATABASE_URL`                                              | required                                             | Compose overrides it to point at the `postgres` service                                                                 |
| `DATABASE_MAX_CONNECTIONS` / `DATABASE_ACQUIRE_TIMEOUT`     | `10` / `5s`                                          |                                                                                                                         |
| `JWT_*`, `OTP_*`, `SESSION_*`, `INVITATION_TTL`, `COOKIE_*` | see `.env.example`                                   | Documented in `../docs/iam.md`                                                                                          |
| `NOTIFY_PROVIDER`                                           | `console`                                            | The only provider today: messages are printed to the log, fully rendered (`../docs/notifications.md`)                   |
| `NOTIFY_FROM_ADDRESS` / `NOTIFY_FROM_NAME`                  | `no-reply@music-licensing.local` / `Music Licensing` | Sender of every message; the name doubles as the product name in the text                                               |
| `APP_PUBLIC_URL`                                            | `http://localhost:5173`                              | Frontend origin used in links (`/accept-invitation#token=…`)                                                            |
| `LICENSE_EXPIRY_SWEEP_INTERVAL`                             | `5m`                                                 | How often approved licenses past their `expires_at` are moved to `expired` (first pass at startup)                      |
| `SSE_KEEP_ALIVE_INTERVAL`                                   | `15s`                                                | Comment line sent on an idle event stream so proxies keep it open                                                       |
| `SSE_MAX_CONNECTION_AGE`                                    | `15m`                                                | An event stream is closed after this; the browser reconnects and re-authenticates with the current cookie               |
| `SSE_REPLAY_LIMIT`                                          | `500`                                                | Events one read of the log delivers (on reconnect with `Last-Event-ID`, or live) before the client is told to `resync`  |
| `REDIS_URL`                                                 | empty                                                | Redis for the license-event fan-out between instances; empty means an in-process bus. Compose sets `redis://redis:6379` |
| `SERVICE_NAME`                                              | `music-licensing-backend`                            | Reported as `service.name`                                                                                              |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                               | empty                                                | OTLP gRPC endpoint; empty means stdout logs only                                                                        |
| `DD_API_KEY`, `DD_SITE`, `DD_ENV`, `DD_HOSTNAME`            |                                                      | Used by the optional Datadog Agent service                                                                              |

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
- Child entities (`scene` under `movie`): collection nested one level, items flat, composite `(parent_id, tenant_id)` foreign keys and server-owned ordering. The research behind it is in `../docs/licensing.md`, "Design notes and sources".
- Delivery (`crates/notifx`): one transport port, messages rendered by functions, the console sender prints the whole email and is the only place a code or token is ever written. The acceptance link carries the token in the URL fragment. Sources in `../docs/notifications.md`, "Design notes and sources".
- Songs are a tenant-wide catalogue: ISRC and ISWC are normalized and validated in the service (check digit included) with `CHECK` mirrors in the table, one ISRC per tenant through a partial unique index, and the rights holder is data on the song, never a user. Deleting a referenced song is a 409, not a cascade.
- Tracks are cues: `start_ms`/`end_ms` on the movie timeline inside the scene's window, enforced from both sides (400 on the track, 409 `SCENE_WINDOW_CONFLICT` on the scene), `usage` background or featured, overlaps allowed. Reads join the song summary, `movie_id` and the license so a scene or a whole movie lists in one call, licensing status included. While the license is active (`requested`, `negotiating`, `approved`) the cue is frozen: song, timing and usage cannot change and the track, its scene and its movie cannot be deleted (409 `TRACK_LOCKED_BY_LICENSE`, `SCENE_HAS_ACTIVE_LICENSES`, `MOVIE_HAS_ACTIVE_LICENSES`); the check is repeated inside the SQL write, so a racing transition cannot be overtaken.
- The license workflow is an explicit state machine (`pending → requested → negotiating → approved | rejected`, `reopen`, `expire`) with one custom method per event (`POST /tracks/{id}/license/{event}`), an append-only history with actor and `source` (`acme`, `rights_holder`, `system`), optimistic concurrency by version (409 `LICENSE_STATE_STALE`), 422 for an event the state does not allow, and a background sweep that expires approved licenses past their `expires_at`.
- Real-time: `GET /events` streams one `license.changed` per committed transition over Server-Sent Events, authenticated by the access cookie (what `EventSource` can send), resumable with `Last-Event-ID` from the event log (positions follow commit order through a per-tenant advisory lock). The bus is a wake-up and the log is the stream: a stream reads `license_events` after its cursor whenever the bus says the log grew, so announcements may arrive in any order and a lagging reader only reads more at once; `resync` is sent only when one read exceeds `SSE_REPLAY_LIMIT`. Keep-alive comments, a maximum connection age, and an in-process broadcast bus that Redis pub/sub fans out across instances when `REDIS_URL` is set.
- Codes and tokens are stored hashed; comparisons are constant time. Refresh tokens rotate through a conditional consume: a reused token, or the loser of two concurrent refreshes, revokes the session (RFC 9700). The OTP cooldown counts from the previous code's issue time whatever its state, so burning the attempts does not buy a fresh code (NIST SP 800-63B).
- The toolchain is pinned to `1.95.0` in `rust-toolchain.toml`, `rust-version`, CI and the Dockerfile; CI and Docker build with `--locked`.
- Runtime sqlx queries (no compile-time database); migrations run at startup.
- Multi-stage Docker build with cargo-chef; the runtime image is a non-root Debian slim.

## Tests

```bash
cargo test --workspace                     # unit tests (no database, no Redis)
DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
REDIS_URL=redis://localhost:6379 \
  cargo test --workspace -- --include-ignored   # plus the #[sqlx::test] suites and the Redis round trip
```

The database suites (`crates/iam/tests`, `crates/licensing/tests`) create a
throwaway database per test and apply `migrations/`, so they need a user that
can `CREATE DATABASE` (the compose user can) and never depend on the base
database being migrated. The `events_api` suite reads the SSE body chunk by
chunk through the actix test service, cookie included. The two
`concurrency.rs` suites reproduce races on a real server: they park
competing requests on a row lock (watching `pg_stat_activity` until both
wait) or hold one transition's announcement while a later one goes through,
and check that a refresh token is consumed exactly once and that the stream
delivers events in commit order whatever the order of announcement.
Shared helpers for those suites live in `iam::testing` (feature
`test-support`): an in-memory notifier that captures OTP codes, request
builders and a one-call OTP login. The licensing unit tests run the stream
on a paused tokio clock to cover keep-alive and the maximum connection age.

## CI

`.github/workflows/backend.yml` runs on every push to `main` and pull request
that touches `backend/`: `cargo fmt --check` and `clippy -D warnings`, the full
test suite against `postgres:17` and `redis:7` services, and a Docker image
build (no push) to prove the image compiles without a database. Every job
uses the pinned toolchain (`dtolnay/rust-toolchain@1.95.0`) and `--locked`,
so a drifted `Cargo.lock` or a newer compiler fails loudly instead of
silently changing what is tested.

## Next steps

1. A real email provider: an SMTP sender in `notifx` (`lettre`) plus Mailpit in compose for local testing (`../docs/notifications.md`, "Adding a real provider").
2. React frontend (lists with live status over `GET /events`) and the root README for the submission.
3. The two concurrency gaps left open by the external review (scene window vs. track insert, concurrent partial updates): `../docs/review-2026-11-01.md`.
