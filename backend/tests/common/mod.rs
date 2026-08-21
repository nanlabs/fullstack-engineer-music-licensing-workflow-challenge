//! Shared harness: a real PostgreSQL container plus the application router.
//!
//! Each test gets its own container and therefore its own isolated database,
//! so tests never contend over shared state and can run in parallel.

// Each integration test binary uses a different subset of this harness.
#![allow(dead_code)]

use std::sync::Arc;
use std::time::Duration;

use axum::body::{to_bytes, Body, Bytes};
use axum::http::{header, HeaderMap, Request, StatusCode};
use futures::StreamExt;
use music_licensing_api::api::{self, AppState};
use music_licensing_api::config::Config;
use music_licensing_api::infrastructure::event_listener::{self, EventStreams, ListenerStatus};
use music_licensing_api::infrastructure::{db, seed};
use serde_json::Value;
use sqlx::PgPool;
use testcontainers::runners::AsyncRunner;
use testcontainers::ContainerAsync;
use testcontainers_modules::postgres::Postgres;
use tower::ServiceExt;

/// A running database plus the configuration that points at it. The container
/// handle must stay alive for the duration of a test.
pub struct TestDatabase {
    _container: ContainerAsync<Postgres>,
    pub config: Config,
    pub pool: PgPool,
    /// The fan-out the default router streams from. No listener is attached to
    /// it, so tests that do not care about live delivery pay nothing for it,
    /// and a stream opened against it correctly reports itself unavailable.
    pub events: Arc<EventStreams>,
}

/// Starts an empty database with no migrations applied.
pub async fn start_database() -> TestDatabase {
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
            ("DEV_TOKEN_ENDPOINT_ENABLED", "true"),
        ],
        Config::from_env,
    )
    .expect("test configuration is valid");

    let pool = db::connect_for_command(&config.database)
        .await
        .expect("failed to connect to the test database");

    let events = Arc::new(EventStreams::new(config.sse_max_connections));

    TestDatabase {
        _container: container,
        config,
        pool,
        events,
    }
}

/// Starts a database with migrations applied.
pub async fn migrated_database() -> TestDatabase {
    let database = start_database().await;
    db::run_migrations(&database.pool)
        .await
        .expect("migrations failed");
    database
}

/// Starts a database with migrations applied and the development seed loaded.
pub async fn seeded_database() -> TestDatabase {
    let database = migrated_database().await;
    seed::apply(&database.pool).await.expect("seeding failed");
    database
}

/// Sets environment variables, runs `body`, then restores the previous values.
///
/// Serialised by a mutex because the environment is process-global.
pub fn with_env<const N: usize, T>(vars: [(&str, &str); N], body: impl FnOnce() -> T) -> T {
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

/// Builds the router the binary would serve for this configuration.
pub fn router(database: &TestDatabase) -> axum::Router {
    router_with_events(database, Arc::clone(&database.events))
}

/// Builds a router that streams from a specific fan-out, for the real-time
/// tests that need a connected listener, a tiny buffer, or a low connection cap.
pub fn router_with_events(database: &TestDatabase, events: Arc<EventStreams>) -> axum::Router {
    api::router(
        AppState::new(database.pool.clone(), &database.config, events),
        &database.config,
    )
}

/// Builds a fan-out with a live `PgListener` attached and waits for it to
/// connect, so a test never races the listener's first `LISTEN`.
pub async fn connected_event_streams(
    database: &TestDatabase,
    streams: EventStreams,
) -> Arc<EventStreams> {
    let streams = Arc::new(streams);
    // The task is left running; it stops when the test's runtime is dropped.
    let _listener = event_listener::spawn(&database.config.database, Arc::clone(&streams));

    for _ in 0..200 {
        if streams.listener_status() == ListenerStatus::Connected {
            return streams;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }

    panic!("the event listener did not connect");
}

/// Builds a router from a modified configuration, for tests that need the
/// application wired differently (a disabled dev-token endpoint, another key).
pub fn router_with(database: &TestDatabase, config: &Config) -> axum::Router {
    api::router(
        AppState::new(database.pool.clone(), config, Arc::clone(&database.events)),
        config,
    )
}

/// Sends a request and returns its status, headers, and body.
pub async fn send(
    database: &TestDatabase,
    request: Request<axum::body::Body>,
) -> (StatusCode, axum::http::HeaderMap, Value) {
    send_to(router(database), request).await
}

/// Sends a request to an explicitly built router.
pub async fn send_to(
    router: axum::Router,
    request: Request<axum::body::Body>,
) -> (StatusCode, axum::http::HeaderMap, Value) {
    let response = router.oneshot(request).await.expect("router call failed");

    let status = response.status();
    let headers = response.headers().clone();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

    (status, headers, body)
}

/// Mints a development token for a display name through the real endpoint.
pub async fn token_for(database: &TestDatabase, name: &str) -> String {
    let (status, _, body) = send(
        database,
        Request::builder()
            .method("POST")
            .uri("/auth/dev-token")
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({ "name": name }).to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED, "token issuance failed: {body}");

    body["access_token"]
        .as_str()
        .expect("access_token")
        .to_string()
}

/// A token for the default test actor. Most tests do not care who is calling.
pub async fn default_token(database: &TestDatabase) -> String {
    token_for(database, "Test Actor").await
}

/// Issues an authenticated GET, returning status and body.
pub async fn get(database: &TestDatabase, path: &str) -> (StatusCode, Value) {
    let token = default_token(database).await;
    let (status, _, body) = get_with_token(database, path, Some(&token)).await;
    (status, body)
}

/// Issues a GET with an explicit token, or none at all.
pub async fn get_with_token(
    database: &TestDatabase,
    path: &str,
    token: Option<&str>,
) -> (StatusCode, axum::http::HeaderMap, Value) {
    let mut builder = Request::builder().uri(path);

    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }

    send(database, builder.body(axum::body::Body::empty()).unwrap()).await
}

/// Issues a GET that is expected to succeed, returning the body.
pub async fn get_ok(database: &TestDatabase, path: &str) -> Value {
    let (status, body) = get(database, path).await;
    assert_eq!(status, StatusCode::OK, "GET {path} failed: {body}");
    body
}

/// Walks every page of a collection, returning the concatenated items and the
/// number of requests it took.
pub async fn drain_pages(database: &TestDatabase, path: &str, limit: u32) -> (Vec<Value>, usize) {
    let separator = if path.contains('?') { '&' } else { '?' };

    let mut items = Vec::new();
    let mut requests = 0;
    let mut cursor: Option<String> = None;

    loop {
        let url = match &cursor {
            None => format!("{path}{separator}limit={limit}"),
            Some(cursor) => format!("{path}{separator}limit={limit}&cursor={cursor}"),
        };

        let body = get_ok(database, &url).await;
        requests += 1;

        items.extend(body["items"].as_array().expect("items array").clone());

        match body["next_cursor"].as_str() {
            Some(next) => cursor = Some(next.to_string()),
            None => break,
        }

        assert!(requests < 50, "pagination did not terminate");
    }

    (items, requests)
}

/// Opens an authenticated SSE stream and returns the raw response parts.
///
/// The body is deliberately not drained here: a stream ends only when the
/// server closes it, and the tests need to read it frame by frame.
pub async fn open_stream(
    router: axum::Router,
    path: &str,
    token: &str,
) -> (StatusCode, HeaderMap, Body) {
    let response = router
        .oneshot(
            Request::builder()
                .uri(path)
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::ACCEPT, "text/event-stream")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("router call failed");

    let status = response.status();
    let headers = response.headers().clone();

    (status, headers, response.into_body())
}

/// Reads an already-open SSE body one frame at a time.
///
/// Frames are the wire form — comment lines included — so that a test can tell
/// a heartbeat apart from an event rather than having both parsed away.
pub struct EventStream {
    body: axum::body::BodyDataStream,
    buffer: String,
    ended: bool,
}

/// One parsed SSE frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreamFrame {
    pub raw: String,
}

impl StreamFrame {
    /// Whether this frame is a comment — which is all a heartbeat is.
    pub fn is_comment(&self) -> bool {
        self.raw.lines().all(|line| line.starts_with(':'))
    }

    pub fn event_type(&self) -> Option<&str> {
        self.raw
            .lines()
            .find_map(|line| line.strip_prefix("event:"))
            .map(str::trim)
    }

    /// The `data:` payload, parsed. Panics on a frame that carries none.
    pub fn data(&self) -> Value {
        let data = self
            .raw
            .lines()
            .find_map(|line| line.strip_prefix("data:"))
            .unwrap_or_else(|| panic!("frame carries no data: {:?}", self.raw));

        serde_json::from_str(data.trim()).expect("event data is JSON")
    }
}

impl EventStream {
    pub fn new(body: Body) -> Self {
        Self {
            body: body.into_data_stream(),
            buffer: String::new(),
            ended: false,
        }
    }

    /// Returns the next frame, or `None` if the server closed the stream.
    /// Panics if neither happens within `within`.
    pub async fn next_frame(&mut self, within: Duration) -> Option<StreamFrame> {
        tokio::time::timeout(within, self.read_frame())
            .await
            .expect("timed out waiting for the stream to emit or close")
    }

    /// Asserts the server closes the stream, and that it emits nothing first.
    pub async fn expect_closed(&mut self, within: Duration) {
        match self.next_frame(within).await {
            None => {}
            Some(frame) => panic!("expected a closed stream, got frame {:?}", frame.raw),
        }
    }

    /// Asserts the stream stays open and silent for the whole window.
    pub async fn expect_silent(&mut self, during: Duration) {
        if let Ok(frame) = tokio::time::timeout(during, self.read_frame()).await {
            panic!("expected silence, got {frame:?}");
        }
    }

    async fn read_frame(&mut self) -> Option<StreamFrame> {
        loop {
            if let Some(index) = self.buffer.find("\n\n") {
                let raw: String = self.buffer.drain(..index).collect();
                self.buffer.drain(.."\n\n".len());
                return Some(StreamFrame {
                    raw: raw.trim_end().to_string(),
                });
            }

            if self.ended {
                return None;
            }

            match self.body.next().await {
                Some(Ok(chunk)) => self.buffer.push_str(&chunk_to_string(chunk)),
                Some(Err(error)) => panic!("stream failed: {error}"),
                None => self.ended = true,
            }
        }
    }
}

fn chunk_to_string(chunk: Bytes) -> String {
    String::from_utf8(chunk.to_vec()).expect("SSE frames are UTF-8")
}

/// Drains an error response body opened as a stream.
pub async fn body_json(body: Body) -> Value {
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}
