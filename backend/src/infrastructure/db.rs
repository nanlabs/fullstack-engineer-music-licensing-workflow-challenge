//! PostgreSQL pool construction, migrations, and the readiness probe.

use std::time::Duration;

use sqlx::migrate::Migrator;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::DatabaseConfig;

/// Migrations are embedded in the binary so that `migrate` needs nothing from
/// the filesystem at runtime.
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Builds the request pool.
///
/// The pool is created lazily: startup does not block on the database, and an
/// unavailable database surfaces through the readiness probe rather than
/// preventing the process from starting.
pub fn build_pool(config: &DatabaseConfig) -> PgPool {
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .acquire_timeout(config.acquire_timeout)
        .connect_lazy(config.url.expose())
        .expect("DATABASE_URL was validated at startup")
}

/// Builds a small, eagerly connected pool for the one-shot `migrate` and `seed`
/// commands, which should fail immediately when the database is unreachable.
pub async fn connect_for_command(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(30))
        .connect(config.url.expose())
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}

/// Whether the database can currently serve the API's reads and writes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatabaseStatus {
    Ready,
    /// Reachable, but read-only — a standby cannot serve writes.
    ReadOnly,
    Unavailable,
}

/// Probes the database for readiness.
///
/// `pg_is_in_recovery()` exercises a real round trip through the pool, which
/// also covers pool-acquisition timeouts, and distinguishes a primary from a
/// standby without writing anything.
pub async fn check_database(pool: &PgPool) -> DatabaseStatus {
    match sqlx::query_scalar::<_, bool>("SELECT pg_is_in_recovery()")
        .fetch_one(pool)
        .await
    {
        Ok(false) => DatabaseStatus::Ready,
        Ok(true) => DatabaseStatus::ReadOnly,
        Err(error) => {
            tracing::warn!(error = %error, "readiness probe failed");
            DatabaseStatus::Unavailable
        }
    }
}
