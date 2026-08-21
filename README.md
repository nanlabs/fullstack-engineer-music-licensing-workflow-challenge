# Music Licensing Workflow API

A backend-only implementation of the ACME Bros Pictures music-licensing challenge. It models movies, scenes, songs, timed track uses, licensing negotiations, immutable history, and live updates for connected collaborators.

The backend-only Rust scope was explicitly approved. It trades away the challenge's general full-stack/React evaluation criterion to go deeper on backend domain modeling, concurrency, transactional consistency, operational behavior, and testing.

## What is included

- REST endpoints for catalog reads and the complete Track lifecycle.
- PostgreSQL persistence, deterministic development seed data, and immutable audit events.
- Optimistic concurrency with retry-safe `PUT` behavior.
- JWT bearer validation plus clearly isolated development-only token issuance.
- Movie- and Scene-scoped Server-Sent Events (SSE).
- RFC 9457 `application/problem+json` errors with stable machine-readable codes.
- Generated OpenAPI and Swagger UI in development.
- Docker Compose, structured JSON logs, health probes, graceful shutdown, and GitHub Actions CI.
- Unit, PostgreSQL integration, and Axum end-to-end tests.

## Technology decisions

Rust was selected even though it is not one of the challenge's suggested stacks. It matches the backend role, makes domain invariants and failure paths explicit in types, and provides a mature asynchronous stack through Tokio, Axum, and SQLx.

The API is REST-only. Resources and commands map naturally onto HTTP, and GraphQL would add another schema and runtime without solving a requirement this workflow has. Live changes use SSE because traffic is one-directional: clients mutate through REST and observe through a stream. WebSockets would add bidirectional capability and a separate upgraded-connection protocol without a matching use case.

Track mutations use `PUT`, not `PATCH`. Each request states the complete desired value of one concern and includes `expected_version`. Repeating a successful request is a no-op; a stale request also succeeds when another writer already produced the same desired result. Stale conflicting intent receives `409 version_conflict`. See [ADR 0001](docs/adr/0001-put-for-track-mutations.md).

## Domain workflow and invariants

```text
pending ───────► in_negotiation ───────► licensed
   │                   ├───────────────► rejected
   │                   └───────────────► cancelled
   └───────────────────────────────────► cancelled
```

- `licensed`, `rejected`, and `cancelled` are terminal through the state endpoint.
- A material Track revision resets any state to `pending`, because permission applied to the previous definition. History preserves that former outcome.
- A Track interval must be non-empty and fit inside its Scene.
- A Track may move only between Scenes of its existing Movie.
- Material writes increment the Track Version and append exactly one event in the same transaction.
- No-op writes increment nothing and append no event.
- Competing commands from one Version allow at most one conflicting material result to commit.

See [CONTEXT.md](CONTEXT.md) for the domain vocabulary without implementation detail.

## Run with Docker Compose

Requirements: Docker with Compose support.

```bash
docker compose up --build
```

Startup is ordered as PostgreSQL → migrations → deterministic seed → API. The API listens at `http://localhost:8080`. Stop it with Ctrl-C or:

```bash
docker compose down
```

The checked-in `.env.example` contains safe local defaults and explains which settings must change in production. In particular, replace `JWT_SECRET`, disable `DEV_TOKEN_ENDPOINT_ENABLED`, and set an explicit CORS allowlist.

## Development authentication

`POST /auth/dev-token` is intentionally not production authentication. It accepts a display name without credentials and returns a signed JWT so the workflow can be exercised locally. The route—and Swagger UI—exist only when `DEV_TOKEN_ENDPOINT_ENABLED=true`.

```bash
curl -sS -X POST http://localhost:8080/auth/dev-token \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace"}'
```

Use the returned `access_token` as `Authorization: Bearer <token>`. In production, disable this endpoint and configure `JWT_SECRET`, `JWT_ISSUER`, and `JWT_AUDIENCE` to match the trusted issuer.

## API and interactive documentation

When development mode is enabled:

- Swagger UI: `http://localhost:8080/swagger-ui`
- OpenAPI JSON: `http://localhost:8080/api-docs/openapi.json`
- Postman collection: [docs/postman/music-licensing.postman_collection.json](docs/postman/music-licensing.postman_collection.json)
- Manual walkthrough: [docs/manual-testing.md](docs/manual-testing.md)

Core routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health/live` | Process liveness |
| `GET` | `/health/ready` | Database readiness and event-listener status |
| `POST` | `/auth/dev-token` | Development-only JWT issuance |
| `GET` | `/movies`, `/songs` | Paginated catalog reads |
| `GET` | `/movies/{movie_id}/scenes` | Ordered Scenes |
| `POST` | `/tracks` | Create a Track |
| `GET`, `PUT` | `/tracks/{track_id}` | Read or replace a Track definition |
| `PUT` | `/tracks/{track_id}/licensing-state` | Set desired licensing state |
| `GET` | `/scenes/{scene_id}/tracks` | Filtered, paginated Scene Tracks |
| `GET` | `/movies/{movie_id}/tracks` | Filtered, paginated Movie Tracks |
| `GET` | `/tracks/{track_id}/history` | Immutable audit history |
| `GET` | `/movies/{movie_id}/track-events` | Movie-scoped SSE |
| `GET` | `/scenes/{scene_id}/track-events` | Scene-scoped SSE |

Collections use opaque keyset cursors. Return `next_cursor` as `?cursor=...`; do not interpret it. Track lists accept a comma-separated `licensing_state` filter.

## Real-time delivery

Each process owns one PostgreSQL listener connection and fans committed notifications out through a bounded Tokio broadcast channel. Client count does not consume request-pool connections. Slow subscribers and streams affected by a listener reset close instead of silently skipping updates. Heartbeats keep idle connections alive, and a semaphore caps streams per process. See [ADR 0002](docs/adr/0002-sse-fan-out-on-tokio.md).

The guarantee is deliberately narrow: a connected client receives matching changes in near real time under normal operation. There is no replay, cursor, gap event, or recovery for time spent disconnected. REST is authoritative. After disconnecting, a client must explicitly reload REST state before subscribing again; otherwise it may remain stale indefinitely. Durable replay is a future extension for consumers that require every intermediate event.

Native browser `EventSource` cannot attach the required bearer header, so browser clients must use a fetch-based reader. Tokens are never accepted in query strings because URLs leak into logs and history.

```js
const response = await fetch(`${baseUrl}/movies/${movieId}/track-events`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (!response.ok || !response.body) throw new Error(`SSE failed: ${response.status}`);

const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer = "";

for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;

  let boundary;
  while ((boundary = buffer.indexOf("\n\n")) !== -1) {
    const frame = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    const data = frame.split("\n").find((line) => line.startsWith("data:"));
    if (data) applyCompleteTrack(JSON.parse(data.slice(5)).track);
  }
}

// On disconnect: reload the relevant REST collection, then reconnect with
// bounded exponential backoff. Do not assume the stream can replay a gap.
```

A browser test page is available at [docs/sse-viewer.html](docs/sse-viewer.html).

## Errors

API failures use `application/problem+json` with `title`, `status`, `detail`, and stable `code` fields. Authentication failures also send `WWW-Authenticate`; retryable `503` responses send `Retry-After`. Clients should branch on `code`, never prose.

Important codes include `invalid_token`, `resource_not_found`, `invalid_state_transition`, `version_conflict`, `database_unavailable`, `sse_temporarily_unavailable`, `sse_connection_limit_reached`, `track_interval_out_of_bounds`, `scene_outside_movie`, and `validation_failed`.

## Local Rust workflow

Requirements: pinned Rust 1.96 toolchain, Docker, and PostgreSQL when running the binary outside Compose.

```bash
cd backend
cargo fmt --all --check
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo test --all-features --locked
```

Integration and end-to-end tests use Testcontainers to start isolated real PostgreSQL databases; they do not use mocks or SQLite.

To verify SQLx metadata against the expected schema:

```bash
docker compose up -d postgres
cd backend
DATABASE_URL=postgres://postgres:postgres@localhost:5432/music_licensing cargo sqlx migrate run
DATABASE_URL=postgres://postgres:postgres@localhost:5432/music_licensing cargo sqlx prepare --check
```

GitHub Actions runs formatting, Clippy with warnings denied, the complete Rust test suite, SQLx metadata validation, and a production Docker build. The Rust toolchain and SQLx CLI version are pinned; Docker compilation uses committed `.sqlx` metadata with `SQLX_OFFLINE=true`.

## Architecture and operations

```text
HTTP/SSE → Axum routes and DTOs → application use cases → SQLx repositories → PostgreSQL
                                        │                         │
                                        └── immutable event ──────┴── NOTIFY
                                                                       │
                                      connected SSE clients ◄── Tokio fan-out
```

- Configuration is read and validated once at startup; secrets are redacted from debug output.
- Migrations and seed are explicit one-shot commands used by Compose.
- Liveness never touches PostgreSQL. Readiness fails only when PostgreSQL cannot serve reads and writes and separately reports whether the event listener is `connected` or `reconnecting`.
- Logs are structured JSON. Request spans carry request ID, method, route, response status, latency, and relevant resource IDs emitted by use cases.
- Shutdown closes long-lived streams first, stops accepting requests, waits within a hard grace period, releases the listener connection, then drains the pool.
- The runtime image is multi-stage and runs as a non-root user.

## Testing strategy

- Domain unit tests pin transitions, terminal states, interval rules, revision reset behavior, serialization, cursor validation, and stream state-machine behavior.
- PostgreSQL integration tests cover migrations, constraints, transactions, event atomicity, ordering, pagination, concurrency, and notifications.
- Axum end-to-end tests cover authentication, catalog and Track routes, RFC 9457 problems, history, SSE scoping, lag closure, heartbeats, limits, listener resets, and shutdown behavior.

The critical concurrency acceptance case sends two different valid commands with the same Track Version: exactly one material change commits, the loser receives `409`, and exactly one event is appended. Agreeing retries all succeed but still produce one change.

## Assumptions, exclusions, and future extensions

- Catalog data is read-only and deterministically seeded for the exercise.
- There are no per-Actor authorization rules beyond valid authentication.
- Track creation has no idempotency key; retrying an ambiguous `POST` can create another legitimate Track.
- Event history is retained indefinitely, but live delivery is not durable messaging.
- The SSE connection limit is per process, not global across replicas.
- No frontend is included under the approved backend-only scope.
- Production identity-provider integration, durable event replay, distributed stream quotas, rate limiting, and audit-retention policy are future work.

## Further documentation

- [Initial implementation plan](INITIAL_IMPLEMENTATION_PLAN.md)
- [ADR 0001: PUT for Track mutations](docs/adr/0001-put-for-track-mutations.md)
- [ADR 0002: SSE fan-out on Tokio](docs/adr/0002-sse-fan-out-on-tokio.md)
- [ADR 0003: Current state with immutable Track events](docs/adr/0003-current-state-with-immutable-track-events.md)
- [Manual API and SSE testing](docs/manual-testing.md)
