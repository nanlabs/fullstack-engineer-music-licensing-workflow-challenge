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
│   └── app/         composition root: config, container, telemetry, HTTP server
└── migrations/      sqlx migrations, applied at startup
```

## Layers

| Layer | Lives in | Responsibility | Must not become |
| --- | --- | --- | --- |
| Transport | `<module>/api/handlers.rs` | Parse and validate input, call one service method, serialise the result | A place for business rules or SQL |
| Use cases | `<module>/service.rs` | Authorization, orchestration, invariants, domain errors | A pass-through to the repository |
| Ports | `<module>/port.rs` | Traits the module *requires* (repositories, notifiers) | A catalogue of every query someone might want |
| Adapters | `<module>/infra/` | Postgres, console notifier, later email or queues | Owner of business decisions |
| Domain | `<module>/mod.rs` | Entities, DTOs, module error enum | Aware of HTTP or SQL |
| Composition | `crates/app` and each crate's `container.rs` | Wire adapters into services and services into routes | A service locator with hidden lookups |

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

| Kind | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION` | 400 | Malformed or invalid input |
| `UNAUTHORIZED` | 401 | No usable identity |
| `FORBIDDEN` | 403 | Identity known, action not allowed |
| `NOT_FOUND` | 404 | Resource does not exist in this tenant |
| `CONFLICT` | 409 | Uniqueness or state conflict |
| `BUSINESS` | 422 | Rule violation on valid input |
| `RATE_LIMITED` | 429 | Too many attempts or requests |
| `EXTERNAL` | 502 | Downstream dependency failed |
| `INTERNAL` | 500 | Bug or infrastructure failure |

Body shape, always:

```json
{ "error": { "code": "OTP_INVALID", "kind": "VALIDATION", "message": "Invalid or incorrect code", "details": { "attempts_remaining": 4 } } }
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
pub struct Deps { pool, config, notifiers... }
impl Container {
    pub fn new(deps: Deps) -> Self;                           // repos -> services
    pub fn configure(&self, cfg: &mut web::ServiceConfig);    // routes under /api/v1
    pub fn spawn_background(&self, cancel: CancellationToken); // periodic jobs
}
```

Replacing an adapter (console notifier by email, Postgres by another store)
is a change in `app`, not in the module.

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

## Telemetry

`tracing` everywhere. `TracingLogger` from `tracing-actix-web` opens a root
span per request (`http.method`, `http.route`, `http.status_code`,
`request_id`, `otel.kind = server`) and the `x-request-id` header is echoed to
the client. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans and log records
are exported over OTLP gRPC with `service.name`, `service.version` and
`deployment.environment.name`, which Datadog maps to service, version and env.
Log records emitted inside a request carry the trace id, so logs and traces
correlate in Datadog without extra configuration. See `backend/README.md`.

## Adding a module (example: `licensing::movie`)

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

## Intentionally not here yet

- API keys and OAuth providers as additional `Actor`/credential types.
- Email delivery (the `OtpNotifier` and `InvitationNotifier` ports exist; only
  the console adapter is wired).
- The licensing data model and workflow (`crates/licensing` is a scaffold).
- Real-time updates (SSE or WebSocket) for the licensing workflow.
- Redis or another cache. Nothing needs one yet.
