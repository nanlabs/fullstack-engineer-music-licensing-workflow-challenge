//! Migration and health-probe tests against a real PostgreSQL container.

use axum::body::to_bytes;
use axum::http::{Request, StatusCode};
use music_licensing_api::api::{self, AppState};
use music_licensing_api::config::Config;
use music_licensing_api::infrastructure::db::{self, DatabaseStatus};
use serde_json::Value;
use sqlx::PgPool;
use testcontainers::runners::AsyncRunner;
use testcontainers::ContainerAsync;
use testcontainers_modules::postgres::Postgres;
use tower::ServiceExt;

/// A running database plus the configuration that points at it. The container
/// handle must stay alive for the duration of a test.
struct TestDatabase {
    _container: ContainerAsync<Postgres>,
    config: Config,
    pool: PgPool,
}

async fn start_database() -> TestDatabase {
    let container = Postgres::default()
        .start()
        .await
        .expect("failed to start postgres container");

    let port = container
        .get_host_port_ipv4(5432)
        .await
        .expect("failed to read mapped port");

    let database_url = format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres");

    // Configuration is built through the real parser so the tests exercise the
    // same validation the binary uses.
    let config = with_env(
        [
            ("DATABASE_URL", database_url.as_str()),
            ("JWT_SECRET", "test-secret-that-is-long-enough-to-pass"),
            ("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
        ],
        Config::from_env,
    )
    .expect("test configuration is valid");

    let pool = db::connect_for_command(&config)
        .await
        .expect("failed to connect to the test database");

    TestDatabase {
        _container: container,
        config,
        pool,
    }
}

/// Sets environment variables, runs `body`, then restores the previous values.
///
/// Serialised by a mutex because the environment is process-global.
fn with_env<const N: usize, T>(vars: [(&str, &str); N], body: impl FnOnce() -> T) -> T {
    use std::sync::Mutex;
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    let _guard = ENV_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    let previous: Vec<(String, Option<String>)> = vars
        .iter()
        .map(|(name, _)| ((*name).to_string(), std::env::var(name).ok()))
        .collect();

    for (name, value) in vars {
        // SAFETY: access to the process environment is serialised by ENV_LOCK.
        unsafe { std::env::set_var(name, value) };
    }

    let result = body();

    for (name, value) in previous {
        match value {
            // SAFETY: as above.
            Some(value) => unsafe { std::env::set_var(&name, value) },
            None => unsafe { std::env::remove_var(&name) },
        }
    }

    result
}

async fn get(database: &TestDatabase, path: &str) -> (StatusCode, Value) {
    let router = api::router(
        AppState {
            pool: database.pool.clone(),
        },
        &database.config,
    );

    let response = router
        .oneshot(
            Request::builder()
                .uri(path)
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .expect("router call failed");

    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

    (status, body)
}

#[tokio::test]
async fn migrations_apply_and_are_idempotent() {
    let database = start_database().await;

    db::run_migrations(&database.pool)
        .await
        .expect("first migration run failed");

    // Re-running must be a no-op, which is what the compose `migrate` job and a
    // restarted container both rely on.
    db::run_migrations(&database.pool)
        .await
        .expect("second migration run failed");

    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT table_name FROM information_schema.tables \
         WHERE table_schema = 'public' ORDER BY table_name",
    )
    .fetch_all(&database.pool)
    .await
    .expect("failed to list tables");

    for expected in ["movies", "scenes", "songs", "tracks", "track_events"] {
        assert!(
            tables.iter().any(|table| table == expected),
            "missing table `{expected}` in {tables:?}"
        );
    }
}

#[tokio::test]
async fn schema_enforces_core_invariants() {
    let database = start_database().await;
    db::run_migrations(&database.pool).await.unwrap();

    let movie_id = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO movies (id, title) VALUES ($1, 'A Movie')")
        .bind(movie_id)
        .execute(&database.pool)
        .await
        .expect("failed to insert movie");

    let blank_title = sqlx::query("INSERT INTO movies (id, title) VALUES ($1, '')")
        .bind(uuid::Uuid::new_v4())
        .execute(&database.pool)
        .await;
    assert!(
        blank_title.is_err(),
        "an empty movie title must be rejected"
    );

    sqlx::query(
        "INSERT INTO scenes (id, movie_id, sequence_number, title, duration_ms) \
         VALUES ($1, $2, 1, 'Opening', 120000)",
    )
    .bind(uuid::Uuid::new_v4())
    .bind(movie_id)
    .execute(&database.pool)
    .await
    .expect("failed to insert scene");

    let duplicate_sequence = sqlx::query(
        "INSERT INTO scenes (id, movie_id, sequence_number, title, duration_ms) \
         VALUES ($1, $2, 1, 'Also One', 90000)",
    )
    .bind(uuid::Uuid::new_v4())
    .bind(movie_id)
    .execute(&database.pool)
    .await;
    assert!(
        duplicate_sequence.is_err(),
        "scene sequence numbers must be unique within a movie"
    );
}

#[tokio::test]
async fn liveness_does_not_depend_on_the_database() {
    let database = start_database().await;

    let (status, body) = get(&database, "/health/live").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "live");
}

#[tokio::test]
async fn readiness_reports_a_healthy_database() {
    let database = start_database().await;
    db::run_migrations(&database.pool).await.unwrap();

    assert_eq!(
        db::check_database(&database.pool).await,
        DatabaseStatus::Ready
    );

    let (status, body) = get(&database, "/health/ready").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ready");
    assert_eq!(body["database"], "ready");
}

#[tokio::test]
async fn readiness_fails_when_the_database_is_gone() {
    let database = start_database().await;

    // Closing the pool makes every subsequent query fail, standing in for an
    // unreachable database without tearing the container down.
    database.pool.close().await;

    let (status, body) = get(&database, "/health/ready").await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["status"], "not_ready");
    assert_eq!(body["database"], "unavailable");
}

#[tokio::test]
async fn unknown_routes_return_a_problem_document() {
    let database = start_database().await;

    let (status, body) = get(&database, "/does-not-exist").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "resource_not_found");
    assert_eq!(body["status"], 404);
}
