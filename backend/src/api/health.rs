//! Liveness and readiness probes.
//!
//! Both endpoints are public: an orchestrator probing them has no bearer token.
//! They return a plain status document rather than a problem document, because
//! a failing probe is a report about the process, not a client error.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::api::AppState;
use crate::infrastructure::db::{self, DatabaseStatus};

#[derive(Debug, Serialize, ToSchema)]
pub struct LivenessBody {
    status: &'static str,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReadinessBody {
    status: &'static str,
    database: &'static str,
    event_listener: &'static str,
}

/// Liveness answers "is this process running?" and therefore never touches the
/// database: a database outage must not cause the orchestrator to restart an
/// otherwise healthy process.
#[utoipa::path(
    get,
    path = "/health/live",
    tag = "Health",
    security(()),
    responses((status = 200, description = "Process is running", body = LivenessBody))
)]
pub async fn live() -> Json<LivenessBody> {
    Json(LivenessBody { status: "live" })
}

/// Readiness answers "can this process serve traffic?" and fails with `503`
/// when PostgreSQL cannot serve reads and writes.
#[utoipa::path(
    get,
    path = "/health/ready",
    tag = "Health",
    security(()),
    responses(
        (status = 200, description = "Database can serve reads and writes", body = ReadinessBody),
        (status = 503, description = "Database is read-only or unavailable", body = ReadinessBody)
    )
)]
pub async fn ready(State(state): State<AppState>) -> (StatusCode, Json<ReadinessBody>) {
    let database = db::check_database(&state.pool).await;
    let event_listener = state.events.listener_status().as_str();

    let (status_code, status, database) = match database {
        DatabaseStatus::Ready => (StatusCode::OK, "ready", "ready"),
        DatabaseStatus::ReadOnly => (StatusCode::SERVICE_UNAVAILABLE, "not_ready", "read_only"),
        DatabaseStatus::Unavailable => {
            (StatusCode::SERVICE_UNAVAILABLE, "not_ready", "unavailable")
        }
    };

    (
        status_code,
        Json(ReadinessBody {
            status,
            database,
            event_listener,
        }),
    )
}
