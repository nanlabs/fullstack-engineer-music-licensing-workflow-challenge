# Architecture

The backend is a Rust workspace organised as bounded contexts with ports and
adapters. The structure is borrowed from
[Manifesto](https://github.com/Abraxas-365/manifesto): small modules with a
fixed shape, explicit composition, typed identifiers, authorization at the
service boundary and errors as a contract. No framework or code generator is
involved. Everything is plain constructors and traits.

```
backend/
├── crates/
│   ├── kernel/      shared vocabulary: ids, Actor, AuthContext, scopes, pagination
│   ├── errx/        AppError + HTTP mapping + ValidatedJson<T>
│   ├── iam/         identity and access (tenants, users, roles, invitations, OTP, sessions)
│   ├── licensing/   domain scaffold (movies, scenes, songs, tracks, license workflow)
│   ├── notifx/      notification delivery: Email, EmailSender, console sender, adapters for the IAM notifier ports
│   └── app/         composition root: config, container, telemetry, HTTP server
└── migrations/      sqlx migrations, applied at startup
```

## Layers

| Layer       | Lives in                                     | Responsibility                                                                        | Must not become                               |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| Transport   | `<module>/api/handlers.rs`                   | Parse and validate input, call one service method, serialise the result               | A place for business rules or SQL             |
| Use cases   | `<module>/service.rs`                        | Authorization, orchestration, invariants, domain errors                               | A pass-through to the repository              |
| Ports       | `<module>/port.rs`                           | Traits the module _requires_ (repositories, notifiers)                                | A catalogue of every query someone might want |
| Adapters    | `<module>/infra/`, `crates/notifx`           | Postgres inside the module; message delivery (console today, email later) in `notifx` | Owner of business decisions                   |
| Domain      | `<module>/mod.rs`                            | Entities, DTOs, module error enum                                                     | Aware of HTTP or SQL                          |
| Composition | `crates/app` and each crate's `container.rs` | Wire adapters into services and services into routes                                  | A service locator with hidden lookups         |

Dependencies point inwards: `app → iam, licensing → kernel, errx`. `licensing`
may depend on `iam` for the middleware and the authorization helpers, never
the other way round.

## Module shape

Every capability has the same layout so that a reader knows where to look:

```
<module>/
├── mod.rs          entity, DTOs (serde + validator), <Module>Error (thiserror) + From<..> for AppError
├── port.rs         async traits the module needs: repositories, notifiers
├── service.rs      use cases; takes &AuthContext and calls authz::require before any repository call
├── infra/          postgres.rs (sqlx, runtime queries), other adapters
└── api/            handlers.rs (actix): ValidatedJson<T>, Auth extractor, web::Data<Container>
```

`iam::role` is the smallest complete example. `iam::auth` is the most
complete one (transactional onboarding, middleware, cookies).

## Kernel vocabulary

- **Typed ids.** `TenantId`, `UserId`, `RoleId`, `InvitationId`, `SessionId`,
  `OtpId` are newtypes over `Uuid` with serde, sqlx and `Display`. Passing a
  `UserId` where a `TenantId` is expected does not compile.
- **Actor.** `enum Actor { User(UserId) }`. An invalid actor is unrepresentable.
  Future variants (API keys, service accounts) are added here.
- **AuthContext.** `{ actor, tenant_id, session_id, email, name, scopes }`.
  Built by the middleware once per request and passed explicitly to services.
- **Scopes.** `resource:action` strings. `*` grants everything inside the
  tenant, `users:*` grants every action on a resource. Anything prefixed with
  `platform:` is rejected: there is no cross-tenant authority in this app.
- **Pagination.** `PageQuery { page, page_size }` normalised and capped,
  `Paginated<T> { items, pagination { page, page_size, total, total_pages }, empty }`.

## Validation at every entry point

Handlers take `ValidatedJson<T>` where `T: Deserialize + Validate`. A body
that does not parse or validate never reaches a service and produces
`VALIDATION_ERROR` with the failing fields in `details.fields`. Services
validate again (`req.validate()`) because they are also called from tests and
future transports.

## Authorization at the service boundary

```rust
pub async fn list(&self, ctx: &AuthContext, tenant_id: TenantId, page: PageQuery) -> Result<_, UserError> {
    authz::require(ctx, tenant_id, scopes::USERS_READ)?;
    ...
}
```

`authz::require` returns `UNAUTHORIZED` (401) when there is no identity,
`ACCESS_DENIED` (403) when the tenant differs or the scope is missing. Granting
scopes (`PUT /users/{id}/scopes`, role creation) goes through
`scopes::ensure_can_grant`, so nobody can hand out more than they hold.

Repositories receive the `tenant_id` explicitly and every query filters by it.
A missing row in another tenant is simply "not found".

## Errors as a contract

`errx::AppError { kind, code, message, details }` is the only error type that
crosses the HTTP boundary.

| Kind           | HTTP | Meaning                                |
| -------------- | ---- | -------------------------------------- |
| `VALIDATION`   | 400  | Malformed or invalid input             |
| `UNAUTHORIZED` | 401  | No usable identity                     |
| `FORBIDDEN`    | 403  | Identity known, action not allowed     |
| `NOT_FOUND`    | 404  | Resource does not exist in this tenant |
| `CONFLICT`     | 409  | Uniqueness or state conflict           |
| `BUSINESS`     | 422  | Rule violation on valid input          |
| `RATE_LIMITED` | 429  | Too many attempts or requests          |
| `EXTERNAL`     | 502  | Downstream dependency failed           |
| `INTERNAL`     | 500  | Bug or infrastructure failure          |

Body shape, always:

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

Each module defines its own `thiserror` enum with `From<ModuleError> for AppError`
mapping variants to stable codes. Codes are part of the API; messages are not.
Internal errors keep their source for logs and never leak it to clients
outside development.

## Composition root

`crates/app` owns configuration (`config.rs`), telemetry (`telemetry.rs`), the
database pool and the containers (`container.rs`) and the HTTP server
(`server.rs`). Each bounded context exposes:

```rust
pub struct Deps { pool, config, notifiers, redis: Option<Client>, shutdown: CancellationToken }
impl Container {
    pub fn new(deps: Deps) -> Self;                           // repos -> services
    pub fn configure(&self, cfg: &mut web::ServiceConfig);    // routes under /api/v1
    pub fn spawn_background(&self, cancel: CancellationToken); // periodic jobs, subscribers
}
```

Replacing an adapter (the console sender by SMTP, Postgres by another store,
the in-process event bus by Redis) is a change in `app`, not in the module:
`NOTIFY_PROVIDER` picks the `notifx` transport and `app` wraps it in the
adapters for the IAM notifier ports (see `notifications.md`).
`spawn_background` is where long-running work lives (IAM's credential
cleanup, licensing's expiry sweep, the Redis subscriber that relays license
events into the local bus): a job is a trusted entry point that calls a
service method without a request context, and that method still records
who (or what) acted. `app` also owns the shutdown token: cancelled on
SIGINT/SIGTERM, it stops the jobs and closes open event streams, so actix's
graceful stop has nothing left to wait for.

## Persistence

- Migrations are plain SQL in `backend/migrations`, applied with
  `sqlx::migrate!` on startup. Numbered `NNNN_name.sql`.
- Queries are runtime `sqlx::query_as` strings so the Docker build does not
  need a database. Each `infra/postgres.rs` keeps a `*Row` struct and a
  `*_COLUMNS` constant to avoid drift.
- Text-backed enums use `#[sqlx(type_name = "text", rename_all = "lowercase")]`.
  `citext` columns are selected as `email::text` and compared with `$n::citext`.
- Multi-step writes (suspend user, accept invitation) run in one transaction
  inside the repository or a dedicated adapter (`auth/onboarding.rs`).
- Invariants that span rows are checked by the service _and_ repeated inside
  the statement (`UPDATE … WHERE … AND NOT EXISTS (…)`, `apply`'s version
  guard), so a request racing a transition cannot slip through; a write that
  touched no row is re-read to tell a conflict from a missing row.
- Database suites are `#[sqlx::test(migrations = "../../migrations")]`: each
  test gets its own throwaway database created from `DATABASE_URL` and
  migrated (seed included), so none depends on the base database having
  been migrated, and a fresh CI service passes the same as a developer's.

## Telemetry

`tracing` everywhere. `TracingLogger` from `tracing-actix-web` opens a root
span per request (`http.method`, `http.route`, `http.status_code`,
`request_id`, `otel.kind = server`) and the `x-request-id` header is echoed to
the client. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans and log records
are exported over OTLP gRPC with `service.name`, `service.version` and
`deployment.environment.name`, which Datadog maps to service, version and env.
Log records emitted inside a request carry the trace id, so logs and traces
correlate in Datadog without extra configuration. See `backend/README.md`.

## Toolchain

One compiler everywhere, `1.95.0`, declared in four places that are bumped
together: `backend/rust-toolchain.toml` (what rustup selects locally),
`rust-version` in `backend/Cargo.toml` (the minimum the crates claim to
support, which is the one we test, not an older promise), the CI action
(`dtolnay/rust-toolchain@1.95.0`, which pins by its `@rev` and does not read
the toolchain file) and the Docker build stage
(`lukemathwalker/cargo-chef:latest-rust-1.95.0`). CI and Docker build with
`--locked`, so a drifted `Cargo.lock` fails instead of resolving anew.

## Adding a module (worked example: `licensing::movie`)

`backend/crates/licensing/src/movie` is the reference implementation of these
steps; copy it for the next module.

1. **Id.** Add `MovieId` to `kernel::ids` with the `define_id!` macro.
2. **Migration.** `backend/migrations/0003_movies.sql` with `tenant_id` on the
   table and an index on `(tenant_id, ...)`.
3. **Domain.** `movie/mod.rs`: `Movie`, `CreateMovieRequest` (validator),
   `MovieResponse`, `MovieError { NotFound, App(AppError) }` and its
   `From<MovieError> for AppError` with codes like `MOVIE_NOT_FOUND`.
4. **Port.** `movie/port.rs`: `#[async_trait] pub trait MovieRepository`
   with tenant-scoped methods only.
5. **Service.** `movie/service.rs`: `MovieService::new(repo)` and methods that
   take `&AuthContext`, call `iam::authz::require(ctx, tenant_id, iam::scopes::MOVIES_READ)`
   and return `Result<_, MovieError>`.
6. **Adapter.** `movie/infra/postgres.rs`: `PostgresMovieRepository` with a
   `MovieRow` and `MOVIE_COLUMNS`.
7. **Handlers.** `movie/api/handlers.rs`: functions taking
   `web::Data<licensing::Container>`, `iam::auth::extract::Auth`,
   `web::Path<_>` and `ValidatedJson<_>`; one service call each.
8. **Wire.** In `licensing/src/container.rs` build the repository and service
   in `new`, register routes in `configure` under a scope wrapped with
   `from_fn(iam::auth::middleware::authenticate)`.
9. **Scopes.** If the module needs new permissions, add constants to
   `iam::scopes` and to `CATALOG`.
10. **Tests.** Unit tests for the service with an in-memory fake of the port
    (see `iam::otp::service` tests) and, when the flow matters end to end, a
    `#[sqlx::test]` in `crates/<crate>/tests`.

### Child entities (worked example: `licensing::scene`)

`backend/crates/licensing/src/scene` shows a module whose rows belong to
another module's rows:

- **Routes.** Register the collection as a sub-scope _inside_ the parent
  scope (`web::scope("/{movie_id}/scenes")` under `/movies`) and the item as
  its own flat scope (`/scenes/{id}`). actix keeps a request in the first
  scope whose prefix matches, so a sibling `/movies/{movie_id}/scenes` scope
  would never be reached.
- **Schema.** The child table carries `tenant_id` and a composite foreign key
  `(parent_id, tenant_id)` to the parent's `(id, tenant_id)` with
  `ON DELETE CASCADE`. Tenant consistency is then a database invariant.
- **Service.** The child service takes the parent's port
  (`Arc<dyn MovieRepository>`) and checks the parent exists in the caller's
  tenant before any collection operation; an unknown or foreign parent is the
  parent's 404 (`MOVIE_NOT_FOUND`). `SceneError` wraps `MovieError` so
  handlers stay one-liners.
- **Ordering.** When children are ordered the server owns the position:
  append on create, a bulk reorder endpoint, a deferred unique constraint and
  a parent row lock in the adapter.
- **Partial updates.** `""` clears text, `null` clears nullable numbers
  (`kernel::json::double_option`).

### Constraint-backed invariants (worked example: `licensing::song`)

When a rule is cheaper to enforce in the database than to re-check in the
service (one ISRC per tenant, a song still referenced by tracks), the adapter
owns the translation: `licensing::db::violation` classifies a failed statement
(unique, foreign key, check, plus the constraint name) and the module maps it
to its own error (`songs_tenant_isrc_key` → `SONG_ISRC_TAKEN`, a foreign-key
violation on delete → `SONG_IN_USE`). Port methods that can hit a constraint
return the module error, so services and handlers never inspect `sqlx`. Keep a
`CHECK` mirror of every service-side format rule so no other writer can store
a value the service would have rejected.

### Read models with joins (worked example: `licensing::track`)

A child that _references_ another module's rows (`track` → `song`) keeps
two shapes: the entity that is validated and written (`Track`, the plain
row) and the view that reads return (`TrackView`: the row plus `movie_id`
and a `SongSummary`, built by the adapter with joins). The response is
derived from the view, so listing a scene or a movie is one query and the
UI never fetches songs row by row. Rules that span two tables (a track must
fit its scene's window) live in the services on both sides, each holding
the other's port (`TrackService` reads scenes; `SceneService` asks
`TrackRepository::outside_window` before narrowing a window). Reference
foreign keys are `ON DELETE RESTRICT` and named, so the adapter maps each
one to its own error (`tracks_song_fkey` → 400 on `song_id`; the delete
side is the song's `SONG_IN_USE`).

### State machines and event logs (worked example: `licensing::license`)

A workflow is a pure transition table in `mod.rs`
(`transition(state, event) -> Result<state, _>`, plus `allowed_events`),
unit-tested without a database, and a service method that is the only
place the state moves. Persistence keeps a mutable projection (the
`licenses` row: `state`, `version`, `expires_at`) and an append-only log
(`license_events`); the port's `apply` writes both in one transaction
guarded by `WHERE version = <read>`, so a lost race is a `false` the service
turns into a 409, never a lost or duplicated event. Transitions are custom
methods (`POST /tracks/{id}/license/{event}`, the event deserialized from
the path), `state` is output-only, the response is the resource. The same
service method serves the background sweep (`expire_due`), which records
`source = system` and no actor. Rows owned 1:1 by another entity share its
primary key and are created by that entity's adapter in the same
transaction (the track adapter calls the license module's `insert_pending`).
The workflow also reaches back into its owner: while the license is active
(`LicenseState::is_active`) the track's song, timing and usage are frozen
and the track, its scene and its movie cannot be deleted (409
`TRACK_LOCKED_BY_LICENSE`, `SCENE_HAS_ACTIVE_LICENSES`,
`MOVIE_HAS_ACTIVE_LICENSES`); the track port exposes `locked_in_scene` /
`locked_in_movie` for the parents, and the adapters guard their own
`UPDATE`/`DELETE` with the SQL list kept next to the enum
(`ACTIVE_STATES_SQL`).

### Real-time delivery (worked example: `licensing::events`)

The module that changes state owns the port that announces it:
`license::port::EventPublisher` is called by `LicenseService` once the
transaction has committed, and a failed publish is a warning, never an
error for the request, because the event is already in the log. The
`events` module provides the adapters and the endpoint: `bus::EventBus`
(a `tokio::sync::broadcast` channel) is both the single-instance publisher
and the hub every open stream reads from; `infra::redis` adds a publisher
that writes to a channel and a subscriber task that relays the channel into
the local bus, so with `REDIS_URL` every instance hears every change
through one path. The stream itself is `EventStreamService::open`: it
checks the scope, subscribes to the bus, replays `changes_since` the
client's `Last-Event-ID` from the repository (or starts at `head_position`
without one), then turns the receiver, a keep-alive ticker, a maximum age
and the shutdown token into a `futures::stream::unfold` of encoded frames
(`events/sse.rs`) that the handler hands to `HttpResponse::streaming`. The
bus is a wake-up, the log is the stream: a received value is never
forwarded; it makes the stream read `changes_since` its cursor again and
emit the rows in position order, so announcements may arrive in any order,
a lagging receiver only reads more at once, and nothing is ever skipped.
The cursor is a tenant-wide identity column handed out under a per-tenant
advisory lock so it follows commit order (`licensing.md`, "Resuming from
`Last-Event-ID` needs commit order"). The fakes assign positions too, so
the service tests cover replay, stale and out-of-order notices, lag and
tenant filtering without a database.

## Frontend

The client lives in `frontend/` and is documented in `frontend.md`. It is
a React single-page application that consumes `/api/v1` as a browser would
consume any third-party API: same-origin through a proxy (Vite in
development, nginx in the image), HttpOnly cookies for the session,
`EventSource` for the stream. Its own layering mirrors this document in
spirit: wire types and per-domain interfaces (`lib/api/contracts.ts`) are
the contract, `lib/api/<domain>.ts` the adapters over one HTTP client,
`lib/queries` the use-case layer the screens call, and routes the
transport. The backend's error codes are the only vocabulary the two sides
share for failures; the frontend maps them to text and keeps the code and
the request id for support.

## Deployment on AWS

[`infra/`](../infra) holds the Terraform for AWS and [`infra.md`](infra.md) the design: one
CloudFront distribution serves the SPA from a private S3 bucket and proxies
`/api/*` to a private ALB through a VPC origin (same origin, so the HttpOnly
cookies stay first-party); the backend runs as ARM64 tasks on ECS Fargate
with rolling deployments and a circuit breaker; PostgreSQL on RDS and Valkey
on ElastiCache Serverless sit in private subnets. Two environments (`dev`,
`prod`) are separate roots with separate state, and the GitHub Actions
workflows that build the image, deploy `dev` and promote the same image to
`prod` behind an approval stay disabled until the repository variable
`INFRA_ENABLED` is set. The only backend change it required was the
`tokio-rustls-comp` feature of the `redis` crate, because ElastiCache
Serverless always speaks TLS (`rediss://`).

## Intentionally not here yet

- API keys and OAuth providers as additional `Actor`/credential types.
- A real email provider (SMTP or an HTTP API). `notifx` ships the console
  sender only; the ports, the adapters and the messages are in place (see
  `notifications.md`).
- Lifecycle events for tracks, scenes and movies on the real-time stream
  (only license changes are published; see `licensing.md`, "Real-time
  updates").
