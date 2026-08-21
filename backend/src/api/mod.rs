//! Axum routes, DTOs, middleware, errors, and SSE streams.

pub mod error;
pub mod health;

use std::time::Duration;

use axum::extract::{DefaultBodyLimit, MatchedPath};
use axum::http::{header, HeaderValue, Method, Request, StatusCode};
use axum::routing::get;
use axum::Router;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::{DefaultOnResponse, TraceLayer};
use tracing::Level;

use crate::config::Config;

/// Maximum accepted request body, matching the plan's 1 MiB limit.
const MAX_BODY_BYTES: usize = 1024 * 1024;

/// Wall-clock budget for finite REST routes. SSE routes are mounted outside
/// this layer, since a long-lived stream is not a slow request.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Dependencies shared by every handler.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

/// Builds the application router.
///
/// Health routes sit outside the timeout and body limits: a probe must be able
/// to answer even while the rest of the stack is degraded.
pub fn router(state: AppState, config: &Config) -> Router {
    let health = Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready));

    let api = Router::new()
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            REQUEST_TIMEOUT,
        ));

    health
        .merge(api)
        .fallback(error::not_found_fallback)
        .layer(cors_layer(config))
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(request_span)
                // Completed requests are access logs, not debug output: one
                // INFO line per request carrying status and latency.
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        // Applied last, so it runs first and the trace span can read the id.
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .with_state(state)
}

/// Builds the per-request span every log line inherits.
///
/// `route` prefers the matched path (`/tracks/{track_id}`) so log fields stay
/// bounded and aggregatable. Routing has not run yet for a router-level layer,
/// so today it falls back to the raw path; parameterised routes arriving in
/// later phases can move this behind a per-route layer if the distinction
/// starts to matter.
fn request_span<B>(request: &Request<B>) -> tracing::Span {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("unknown");

    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str)
        .unwrap_or_else(|| request.uri().path());

    tracing::info_span!(
        "http_request",
        request_id = %request_id,
        method = %request.method(),
        route = %route,
    )
}

/// CORS is driven by an explicit allowlist; an empty list allows no browser
/// origin at all, which is the correct default for a service with no frontend.
fn cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| match HeaderValue::from_str(origin) {
            Ok(value) => Some(value),
            Err(_) => {
                tracing::warn!(origin = %origin, "ignoring CORS origin that is not a valid header value");
                None
            }
        })
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
}
