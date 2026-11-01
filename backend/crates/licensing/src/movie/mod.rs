//! Movies: the catalogue entry that owns scenes.
//!
//! Suggested shape, mirroring `iam::role`:
//!
//! - `mod.rs`: `Movie { id: MovieId, tenant_id: TenantId, title, release_year,
//!   status, created_at, updated_at }`, `CreateMovieRequest` /
//!   `UpdateMovieRequest` (derive `validator::Validate`), `MovieResponse`,
//!   `MovieError` with `From<MovieError> for errx::AppError`
//!   (stable codes such as `MOVIE_NOT_FOUND`).
//! - `port.rs`: `#[async_trait] trait MovieRepository` with tenant-scoped
//!   `get`, `list`, `insert`, `update`, `delete`.
//! - `service.rs`: `MovieService` receiving `&kernel::AuthContext` and calling
//!   `iam::authz::require(ctx, tenant_id, iam::scopes::MOVIES_READ | MOVIES_WRITE)`
//!   before touching the repository.
//! - `infra/postgres.rs`: `PostgresMovieRepository` with runtime `sqlx` queries
//!   that always filter by `tenant_id`.
//! - `api/handlers.rs`: actix handlers taking `web::Data<Container>`,
//!   `iam::auth::extract::Auth` and `errx::ValidatedJson<_>`.
//! - `MovieId` goes in `kernel::ids` next to the IAM ids.
//! - Migration `migrations/0003_movies.sql`.
