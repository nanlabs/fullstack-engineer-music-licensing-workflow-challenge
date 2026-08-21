//! Liveness and readiness probes.
//!
//! Both endpoints are public: an orchestrator probing them has no bearer token.
//! They return a plain status document rather than a problem document, because
//! a failing probe is a report about the process, not a client error.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;

use crate::api::AppState;
use crate::infrastructure::db::{self, DatabaseStatus};

#[derive(Debug, Serialize)]
pub struct LivenessBody {
    status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReadinessBody {
    status: &'static str,
    database: &'static str,
}

/// Liveness answers "is this process running?" and therefore never touches the
/// database: a database outage must not cause the orchestrator to restart an
/// otherwise healthy process.
pub async fn live() -> Json<LivenessBody> {
    Json(LivenessBody { status: "live" })
}

/// Readiness answers "can this process serve traffic?" and fails with `503`
/// when PostgreSQL cannot serve reads and writes.
pub async fn ready(State(state): State<AppState>) -> (StatusCode, Json<ReadinessBody>) {
    let database = db::check_database(&state.pool).await;

    let (status_code, status, database) = match database {
        DatabaseStatus::Ready => (StatusCode::OK, "ready", "ready"),
        DatabaseStatus::ReadOnly => (StatusCode::SERVICE_UNAVAILABLE, "not_ready", "read_only"),
        DatabaseStatus::Unavailable => {
            (StatusCode::SERVICE_UNAVAILABLE, "not_ready", "unavailable")
        }
    };

    (status_code, Json(ReadinessBody { status, database }))
}
