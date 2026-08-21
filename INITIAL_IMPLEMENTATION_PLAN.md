# Initial Backend Implementation Plan

## Objective and scope

Build the backend of the Music Licensing Workflow challenge in Rust. The hiring team explicitly approved a backend-only submission.

Included:

- Axum and Tokio REST API
- SQLx and PostgreSQL
- Seeded Movies, Scenes, and Songs
- Track creation, revision, queries, and licensing workflow
- Optimistic concurrency and idempotent update semantics
- JWT issuance and endpoint protection
- Immutable Track history with actor attribution
- Best-effort real-time Track updates over Server-Sent Events (SSE) while a
  client is connected
- OpenAPI, tests, Docker Compose, CI, logging, and health checks

Deliberately excluded:

- Frontend
- Credential storage, registration, account administration, roles, and
  fine-grained authorization
- Refresh tokens, revocation, password reset, and email verification
- Movie, Scene, and Song write APIs
- Individual rights-holder decisions, pricing, offers, documents, and approvals
- Cross-Movie Track relocation and hard deletion
- Transition reasons and notes
- License expiration, revocation, and renewal
- Redis, Kafka, Kubernetes, ArgoCD, production metrics, and tracing infrastructure
- Durable event replay, missed-event recovery, and delivery guarantees while a
  client is disconnected

## Architecture

Match the challenge repository layout and use lightweight ports and adapters:

```text
/
├── backend/
│   ├── src/
│   │   ├── domain/          # Entities, invariants, workflow rules
│   │   ├── application/     # Use cases and transaction orchestration
│   │   ├── infrastructure/  # PostgreSQL repositories and event delivery
│   │   ├── api/             # Axum routes, DTOs, middleware, errors, SSE
│   │   └── main.rs          # Configuration and dependency wiring
│   ├── migrations/
│   ├── tests/
│   ├── .sqlx/
│   ├── Cargo.toml
│   └── Dockerfile
├── docs/
│   └── adr/
├── compose.yml
├── .env.example
├── CONTEXT.md
└── README.md
```

- Domain code has no Axum or SQLx dependencies.
- HTTP DTOs are separate from domain objects.
- Application services coordinate domain behavior and transactions.
- Infrastructure implements narrow persistence ports.
- Avoid unnecessary traits and generic abstractions.
- The Track row is authoritative current state; events provide audit and delivery history. This is not event sourcing.

## Domain model

```text
Movie 1 ── * Scene
Scene 1 ── * Track
Song  1 ── * Track
```

Reference data:

```text
Movie: id, title, created_at
Scene: id, movie_id, sequence_number, title, duration_ms
Song: id, title, artist_name
```

Track:

```text
id
scene_id
song_id
scene_start_ms
scene_end_ms
licensing_state
version
created_at
updated_at
```

A Track is one timed use of exactly one Song in exactly one Scene. It owns its licensing state; the Song has no global licensing state.

Interval invariant:

```text
0 <= scene_start_ms < scene_end_ms <= scene.duration_ms
```

Tracks may overlap. Track duration is derived rather than stored.

## Licensing workflow

The domain layer enforces this explicit transition table:

| From | Allowed destination |
|---|---|
| `Pending` | `InNegotiation`, `Cancelled` |
| `InNegotiation` | `Licensed`, `Rejected`, `Cancelled` |
| `Licensed` | None through the state endpoint |
| `Rejected` | None through the state endpoint |
| `Cancelled` | None through the state endpoint |

Assigning any state to itself is an idempotent no-op, not a transition. In
particular, `Pending → Rejected` and `Pending → Licensed` are invalid.

- `Licensed`, `Rejected`, and `Cancelled` are terminal for direct state updates.
- `Licensed` means all required permissions were obtained outside the system.
- No transition reason or note is required.

## Track revisions

- Song, Scene, and interval may be revised.
- Every material revision atomically resets licensing to `Pending`.
- Identical desired values are an idempotent no-op.
- Material revisions are deliberately allowed from terminal states. Revising a
  `Licensed` or `Rejected` Track starts a new licensing proposition; revising a
  `Cancelled` Track explicitly revives it. The immutable history preserves the
  former terminal outcome. This behavior must be prominent in the README.
- Scene relocation is permitted only within the current Movie.
- Cross-Movie relocation requires creating a new Track.
- History retains the previous and new definitions.
- A Scene relocation event is visible to both old and new Scene streams.

## Persistence and seed data

Create SQL migrations for:

- `movies`
- `scenes`
- `songs`
- `tracks`
- `track_events`

Enforce foreign keys, positive durations and sequence numbers, unique Scene sequence numbers within a Movie, non-empty names, interval ordering, and valid state values.

Movie, Scene, and Song titles plus `artist_name` are limited to 255 characters,
using database `CHECK` constraints equivalent to
`char_length(value) BETWEEN 1 AND 255`. Even at four bytes per Unicode code
point, this keeps the complete Track notification payload safely below
PostgreSQL's 8,000-byte notification limit.

Schema details:

- `tracks.version` starts at `1`.
- Duplicate Tracks with the same Scene, Song, and interval are allowed because
  they may represent distinct intended uses. Consequently, retrying a
  `POST /tracks` after losing its response may create a duplicate; this is a
  documented limitation rather than something inferred from field uniqueness.
- PostgreSQL enforces `0 <= scene_start_ms < scene_end_ms` with a local row
  constraint.
- `scene_end_ms <= scene.duration_ms` is a cross-table domain check performed
  after reading the Scene in the same transaction; it cannot be a SQL `CHECK`
  constraint. Scene duration is stable because there is no Scene write API.
- Application update statements set `updated_at = clock_timestamp()`; no
  database trigger maintains it.
- The event JSONB field is named `payload`, and every payload contains
  `payload_schema_version`.
- Required indexes include `movies(created_at, id)`,
  `scenes(movie_id, sequence_number, id)`, `songs(title, id)`,
  `tracks(scene_id, created_at, id)`, `tracks(created_at, id)`,
  `tracks(song_id)`, and `track_events(track_id, id)`.
- A relocation event records both its previous and new Scene IDs in `payload`;
  no separate event-scope table is needed without replay queries.

Provide separate executable commands:

```text
migrate
seed
serve
```

The development seed is deterministic, idempotent, and optional in production.
It creates sample Movies, Scenes, and Songs; it does not create identities or
credentials.

## Authentication

Implement:

```text
POST /auth/dev-token
```

- Accept a display name, trim it, require it to be non-empty, and limit it to 64
  characters.
- Derive `sub` as UUIDv5 from the normalized name and a fixed application
  namespace, giving the same demo identity a stable actor ID across processes
  and restarts.
- Issue a signed JWT with `sub`, `name`, `iss`, `aud`, `iat`, and `exp`; default
  lifetime is one hour.
- Validate signature, issuer, audience, and expiration.
- Protect catalog, Track, history, and SSE endpoints.
- Leave health and API documentation public.
- Record `sub` as `actor_id` and the signed `name` as `actor_name` on Track
  events so history is readable without an identity table.
- Require a high-entropy `JWT_SECRET` of at least 32 bytes from configuration,
  with no source-code fallback.
- Allow approximately five seconds of clock-skew leeway during validation.
- Implement authentication as an Axum `FromRequestParts` extractor returning
  validated claims; handlers declaring that extractor are protected by type.
- Gate token issuance behind `DEV_TOKEN_ENDPOINT_ENABLED`, enabled for local
  development and tests and required to be disabled outside development. When
  disabled, do not mount the route; requests receive the API's ordinary `404`
  `resource_not_found` response.
- Do not implement credentials, registration, roles, refresh tokens, or
  revocation.

This demonstrates JWT issuance, validation, route protection, and actor
attribution; it is not a production authentication system because callers may
claim any display name. A real deployment replaces only `/auth/dev-token` with
an identity provider or credential service while retaining bearer validation
and actor attribution. When development issuance is disabled, the API
deliberately has no local token source; a deployment must supply tokens through
its trusted issuer.

## REST API

Authentication and catalog:

```text
POST /auth/dev-token
GET  /movies
GET  /movies/{movie_id}/scenes
GET  /songs
```

Track API:

```text
POST /tracks
GET  /tracks/{track_id}
PUT  /tracks/{track_id}
PUT  /tracks/{track_id}/licensing-state
GET  /tracks/{track_id}/history
GET  /scenes/{scene_id}/tracks
GET  /movies/{movie_id}/tracks
```

Collection endpoints use deterministic opaque cursor pagination with a default
limit of 50 and maximum of 100. The cursor is URL-safe base64 encoding of a
versioned JSON object containing the last sort values.

Sort keys and supporting indexes are explicit per collection:

- `GET /movies`: `(created_at, id)`, using `movies(created_at, id)`.
- `GET /movies/{movie_id}/scenes`: `(sequence_number, id)`, using
  `scenes(movie_id, sequence_number, id)` so Scenes appear in story order.
- `GET /songs`: `(title, id)`, using `songs(title, id)` for a useful selection
  order.
- Scene and Movie Track collections: `(created_at, id)`, supported by
  `tracks(scene_id, created_at, id)`, `tracks(created_at, id)`, and
  `scenes(movie_id, id)`.

Concurrent inserts do not duplicate existing results; new rows sorting before
the cursor may not appear until a fresh traversal.

Track lists include cancelled records by default, support state filters, and
embed a Song summary containing ID, title, and artist name.

Configure CORS from an environment-driven allowlist; do not use a wildcard in
production. Apply a 1 MiB request-body limit and a 30-second timeout to finite
REST routes. SSE routes are excluded from the request timeout and use their own
lifetime and shutdown controls.

### PUT decision

Track revision and licensing-state endpoints use `PUT` because they set a complete desired representation. This makes retry, no-op, idempotency, and optimistic-concurrency behavior explicit. Partial `PATCH` semantics were deliberately rejected.

Both `PUT` operations are idempotent in terms of observable server state:

- Repeating a successful licensing-state request does not increment the Track
  version or emit another event.
- Repeating a successful Track revision with the same Scene, Song, and interval
  does not reset licensing again, increment the version, or emit another event.
- A stale retry succeeds as a no-op only when its desired result already equals
  the current result.
- A stale request expressing different intent returns `409 Conflict`.
- Responses need not be byte-for-byte identical; HTTP idempotency concerns the
  intended server-side effect.

The README must explain these guarantees and include one retry example for each
`PUT` endpoint.

## Optimistic concurrency and update retries

`POST /tracks` does not implement request-level idempotency in this iteration.
Clients should avoid automatically retrying creation after an ambiguous network
failure. Request-level creation idempotency remains outside the current scope.

Track revision and state requests include `expected_version`:

- Material changes increment the version.
- Same-state and identical-revision requests succeed without incrementing it.
- This includes a stale request whose desired result already equals current
  state: it succeeds as a no-op (last-writer-wins-if-agreeing).
- A stale version with a different desired result returns `409 Conflict`.
- Competing material commands from the same version allow exactly one commit.

The API deliberately carries `expected_version` in the versioned command body
instead of using `If-Match`. Keeping the precondition beside the desired state
provides one explicit representation of command intent, and entity-tag
semantics add little because the resource already exposes an integer version.
The application evaluates that version together with the desired result,
allowing agreeing retries to succeed while stale, conflicting intent returns
`409`.

## Immutable events and history

Event types:

- `TrackCreated`
- `TrackRevised`
- `LicensingStateChanged`

Each event contains a globally increasing ID, Track and Movie IDs, Track
version, event type, versioned JSONB payload, actor ID and display name,
timestamp, and previous/new Scene IDs for relocation events.

Every write transaction follows this fixed order:

```text
BEGIN
→ SET LOCAL lock_timeout = '2s'
→ validate and lock reference rows
→ insert or lock/update the Track row
→ insert the immutable event row
→ NOTIFY
→ commit
```

The timeout bounds waits on reference rows and Track `SELECT ... FOR UPDATE`
locks. A timeout rolls the transaction back and returns retryable
`503 Service Unavailable` with problem code `write_contention` and
`Retry-After: 2`. The SQLx request pool defaults to 10 connections and a
two-second acquire timeout, configurable through `DATABASE_MAX_CONNECTIONS`
and `DATABASE_ACQUIRE_TIMEOUT`. Pool acquisition timeout returns retryable
`503 Service Unavailable` with problem code `database_unavailable` and
`Retry-After: 2`; it is distinct because it can affect reads as well as writes.
The dedicated `PgListener` connection is separate from the pool.

Events are inserted atomically with Track changes and retained indefinitely for
audit history. `GET /tracks/{id}/history` orders events by `id` ascending and
uses the last event ID as its cursor through `track_events(track_id, id)`.
Operations on one Track serialize on its row lock, so that Track's event IDs,
versions, and commit order remain aligned without a global ordering lock.

Create an ADR for the current-state table plus immutable audit events and the
PostgreSQL notification design. Record that SSE intentionally provides only
best-effort live updates to connected clients, without replay or recovery.

## Real-time updates

Scoped streams:

```text
GET /movies/{movie_id}/track-events
GET /scenes/{scene_id}/track-events
```

Delivery process:

1. Change the Track and insert its audit event in one transaction. Call
   PostgreSQL `NOTIFY` in that transaction so notification occurs only after
   commit.
2. The notification contains event ID and type, Movie ID, affected Scene IDs
   (both old and new for relocation), and the complete current Track API
   representation, including Song summary, interval, licensing state, and
   version. It contains identifiers, enums, integers, and catalog text bounded
   by database constraints, making its maximum size safely lower than
   PostgreSQL's notification limit. No database read is needed to construct the
   SSE payload.
3. Each process owns exactly one dedicated `PgListener` connection and fans
   notifications out through a `tokio::sync::broadcast` channel with capacity
   1024. HTTP connections never create their own PostgreSQL listeners.
4. Each SSE handler subscribes to that channel and forwards only notifications
   matching its Movie or Scene scope.
5. The server sends no priming event, snapshot, cursor, or recovery signal. A
   client may load current state through REST and then subscribe for subsequent
   live updates.
6. When `broadcast::error::RecvError::Lagged` occurs, close that subscriber's
   stream instead of silently skipping events. When the `PgListener` connection
   drops, signal every open stream on that process to close before reconnecting
   the listener. Missed updates are not recovered. Log the cause and affected
   scope for every degraded close.
7. If the listener is reconnecting, reject new SSE connections with retryable
   `503 sse_temporarily_unavailable` and `Retry-After: 2`.
8. Send an SSE comment heartbeat every 15 seconds so proxies do not drop idle
   streams.
9. Limit concurrent SSE connections per process with a configurable semaphore,
   defaulting to 1,000. Reject excess connections with
   `503 sse_connection_limit_reached` and `Retry-After: 2`.
10. Graceful shutdown uses a process-wide broadcast. Each stream selects between
    events, heartbeat ticks, and shutdown; the server then applies a hard
    timeout and drops any remaining connections.

Native browser `EventSource` cannot attach an `Authorization` bearer header.
The API deliberately requires a fetch-based SSE client so the JWT remains in
the header; query-string tokens were rejected because URLs commonly leak into
access logs and browser history. Document this client constraint and provide a
working example.

The fetch-based client may reconnect with bounded exponential backoff, but it
does not retain an event cursor, request replay, automatically refetch, or
handle a gap-notification event. The README example demonstrates opening the
stream and applying complete Track representations while connected.

The guarantee is deliberately narrow: a connected client receives matching
Track changes in near real time under normal operation. A disconnected or
lagging client may miss updates. REST exposes authoritative current state when a
client explicitly loads or refreshes it; the SSE protocol itself provides no
convergence or recovery guarantee. A client that reconnects without explicitly
reloading REST state may display stale data indefinitely; this is an accepted
trade-off for keeping the demonstration simple. Durable replay is a possible
future extension for consumers that need every intermediate event.

## API documentation and errors

Generate OpenAPI from Rust routes and DTOs and serve Swagger UI in development.

Use RFC 9457 `application/problem+json` with stable codes including:

- `invalid_token`
- `resource_not_found`
- `invalid_state_transition`
- `version_conflict`
- `write_contention`
- `database_unavailable`
- `sse_temporarily_unavailable`
- `sse_connection_limit_reached`
- `track_interval_out_of_bounds`
- `scene_outside_movie`
- `validation_failed`

## Tests

Domain unit tests cover transitions, terminal states, revision resets, no-op behavior, and interval rules.

Named revision tests must prove that revising each terminal state (`Licensed`,
`Rejected`, and `Cancelled`) resets it to `Pending` and preserves the former
outcome in history.

PostgreSQL integration tests cover transactions, event atomicity, pagination,
optimistic-concurrency races, per-Track history ordering, bounded row-lock
contention, and `LISTEN/NOTIFY`.

Pagination tests verify Movie and Track creation order, Scene sequence order,
Song title order, cursor boundaries, and the absence of duplicate rows across
pages.

End-to-end Axum tests cover development JWT issuance and protection, Track operations,
problem responses, history, and SSE filtering, close-on-lag, heartbeat, and
shutdown. Authentication tests include a missing token, wrong signing key,
expired token, incorrect issuer, incorrect audience, invalid display names, and
a disabled development-token endpoint.

Real-time tests verify:

- `LISTEN/NOTIFY` reaches a connected subscriber.
- Movie and Scene streams receive only in-scope notifications.
- A relocation reaches both previous and new Scene streams.
- No priming event is emitted; an idle connection receives only heartbeats.
- Created, revised, and state-change notifications contain the complete current
  Track representation needed by a connected client.
- A lagging subscriber's stream closes rather than skipping events.
- Listener disconnection closes existing streams, and new connections receive
  retryable `sse_temporarily_unavailable` until reconnection.
- The connection cap returns `sse_connection_limit_reached`.
- Graceful shutdown closes streams within the hard timeout.
- Row-lock contention returns retryable `503 write_contention`.
- Pool acquisition timeout returns retryable `503 database_unavailable` for
  both read and write requests.

Use real temporary PostgreSQL containers rather than mocks or SQLite.

Critical concurrency acceptance test:

1. Two commands use the same Track version.
2. They request different valid transitions.
3. Exactly one succeeds.
4. The loser receives `409 Conflict`.
5. Exactly one event commits.

Also test that a stale command succeeds without a new event when its desired
result already matches the current state.

## Docker and operations

Use a multi-stage Dockerfile with a non-root runtime user.

Docker Compose startup:

```text
postgres → migrate → seed → api
```

- PostgreSQL has a health check.
- Migration and development seed services are one-shot jobs.
- The API starts only after they succeed.
- Graceful shutdown broadcasts to HTTP and SSE tasks, closes the PostgreSQL
  listener and pool, and enforces a hard timeout before dropping remaining
  connections.

Health endpoints:

```text
GET /health/live
GET /health/ready
```

Readiness fails with `503` when PostgreSQL cannot serve reads and writes. A
dropped `PgListener` does not fail readiness because database operations and
writes remain available while it reconnects. Existing streams close and may
miss updates; new SSE connections receive a retryable `503` until the listener
returns. The readiness body reports `event_listener` as `connected` or
`reconnecting`, making this degradation visible without removing a recovering
instance from service.

Logs use structured JSON and include request IDs, routes, status, latency, and
relevant resource IDs.

The committed `.env.example` lists at least `DATABASE_URL`,
`DATABASE_MAX_CONNECTIONS`, `DATABASE_ACQUIRE_TIMEOUT`, `JWT_SECRET`,
`DEV_TOKEN_ENDPOINT_ENABLED`, `CORS_ALLOWED_ORIGINS`, and
`SSE_MAX_CONNECTIONS`, with comments explaining safe development values and
production requirements.

## Continuous integration

GitHub Actions runs:

```text
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo sqlx prepare --check
docker build
```

Commit SQLx's `.sqlx` offline query metadata. Tests use testcontainers to create
isolated real PostgreSQL databases. A separate PostgreSQL CI service exists only
to apply migrations and run `cargo sqlx prepare --check` against the expected
schema; this is not the database used by integration tests. Docker builds set
`SQLX_OFFLINE=true`, because no database is available while compiling the image.

Pin the Rust toolchain and cache dependencies.

## Documentation

The README documents:

- Backend-only approval and scope
- Development token issuance and a clear warning that it is not production
  authentication
- Why Rust was selected even though it is not one of the challenge's suggested
  stacks: it matches the role, provides strong domain modeling, and offers an
  excellent async stack through Tokio and Axum.
- Explicitly acknowledge that the approved backend-only Rust focus trades away
  the challenge's general full-stack evaluation criterion.
- REST-only rationale
- Reason for `PUT` mutation endpoints
- Domain workflow and invariants
- Optimistic concurrency and idempotent `PUT` behavior
- Best-effort real-time delivery while connected and the explicit absence of
  replay, missed-event recovery, or disconnected-client guarantees
- The accepted consequence that a reconnecting client remains stale until it
  explicitly reloads current REST state
- Why live-only delivery was selected: the exercise requires immediate
  visibility for connected users, while durable replay remains a documented
  future extension for audit-grade consumers
- Architecture and testing strategy
- Assumptions, exclusions, and future extensions

Create `CONTEXT.md` as a glossary without implementation details. Create ADRs only for durable, non-obvious trade-offs.

## Submission workflow

1. Fork the challenge repository.
2. Create a focused feature branch.
3. Commit in meaningful, reviewable increments.
4. Push the branch and open a Pull Request using the provided template.
5. Complete the template's testing section with the exact commands run and the
   behaviors covered.
6. Link the architecture documentation and ADR from the Pull Request.

## Implementation order

1. Bootstrap configuration, migrations, and health checks.
2. Add deterministic seed data and read-only catalog APIs.
3. Implement JWT issuance, validation, and protection.
4. Implement Track creation and atomic event persistence.
5. Implement licensing transitions and optimistic concurrency.
6. Implement revisions, Track lists, and history.
7. Implement PostgreSQL notifications, scoped SSE streams,
   close-on-degraded-delivery, heartbeat, connection limits, and graceful stream
   shutdown.
8. Add OpenAPI, Docker, CI, observability, ADRs, and final README documentation.

Each phase must leave the application runnable and tested before proceeding.
The agreed goal is the complete backend plan above; SSE and the final quality
work are not demoted to optional scope. If external constraints later force a
cut, stop at a runnable phase boundary and document the designed-but-deferred
work rather than leaving a partial subsystem.

Explicit runnable gates:

- After phase 4, authentication, catalog reads, and Track creation work through
  Docker Compose with migrations, seed data, and committed events.
- After phase 5, the full licensing workflow and concurrency behavior work with
  no dependency on unfinished SSE code.
- After phase 6, revision, list, and history APIs are complete and documented;
  phase 7 adds delivery without changing their contracts.
