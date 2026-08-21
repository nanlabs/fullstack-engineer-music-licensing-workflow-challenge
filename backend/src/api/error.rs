//! RFC 9457 `application/problem+json` responses.
//!
//! Every error the API returns carries a stable machine-readable `code`, so
//! clients branch on that rather than on prose or bare status codes.

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;

const PROBLEM_JSON: &str = "application/problem+json";

/// Stable problem codes. New variants are added as later phases need them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProblemCode {
    InvalidToken,
    ResourceNotFound,
    InvalidStateTransition,
    VersionConflict,
    TrackIntervalOutOfBounds,
    SceneOutsideMovie,
    DatabaseUnavailable,
    SseTemporarilyUnavailable,
    SseConnectionLimitReached,
    ValidationFailed,
    InternalError,
}

impl ProblemCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InvalidToken => "invalid_token",
            Self::ResourceNotFound => "resource_not_found",
            Self::InvalidStateTransition => "invalid_state_transition",
            Self::VersionConflict => "version_conflict",
            Self::TrackIntervalOutOfBounds => "track_interval_out_of_bounds",
            Self::SceneOutsideMovie => "scene_outside_movie",
            Self::DatabaseUnavailable => "database_unavailable",
            Self::SseTemporarilyUnavailable => "sse_temporarily_unavailable",
            Self::SseConnectionLimitReached => "sse_connection_limit_reached",
            Self::ValidationFailed => "validation_failed",
            Self::InternalError => "internal_error",
        }
    }

    fn status(self) -> StatusCode {
        match self {
            Self::InvalidToken => StatusCode::UNAUTHORIZED,
            Self::ResourceNotFound => StatusCode::NOT_FOUND,
            Self::InvalidStateTransition => StatusCode::UNPROCESSABLE_ENTITY,
            Self::VersionConflict => StatusCode::CONFLICT,
            Self::TrackIntervalOutOfBounds => StatusCode::UNPROCESSABLE_ENTITY,
            Self::SceneOutsideMovie => StatusCode::UNPROCESSABLE_ENTITY,
            Self::DatabaseUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            Self::SseTemporarilyUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            Self::SseConnectionLimitReached => StatusCode::SERVICE_UNAVAILABLE,
            Self::ValidationFailed => StatusCode::UNPROCESSABLE_ENTITY,
            Self::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::InvalidToken => "Invalid token",
            Self::ResourceNotFound => "Resource not found",
            Self::InvalidStateTransition => "Invalid state transition",
            Self::VersionConflict => "Version conflict",
            Self::TrackIntervalOutOfBounds => "Track interval out of bounds",
            Self::SceneOutsideMovie => "Scene outside movie",
            Self::DatabaseUnavailable => "Database unavailable",
            Self::SseTemporarilyUnavailable => "Event stream temporarily unavailable",
            Self::SseConnectionLimitReached => "Event stream connection limit reached",
            Self::ValidationFailed => "Validation failed",
            Self::InternalError => "Internal server error",
        }
    }
}

#[derive(Debug)]
pub struct ApiError {
    code: ProblemCode,
    detail: String,
    /// Present on retryable problems; rendered as the `Retry-After` header.
    retry_after_seconds: Option<u32>,
    /// Set on authentication failures; rendered as `WWW-Authenticate`.
    bearer_challenge: bool,
}

impl ApiError {
    pub fn new(code: ProblemCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
            retry_after_seconds: None,
            bearer_challenge: false,
        }
    }

    pub fn retryable_in(mut self, seconds: u32) -> Self {
        self.retry_after_seconds = Some(seconds);
        self
    }

    /// Adds the `WWW-Authenticate` header RFC 9110 requires on a `401`.
    pub fn with_bearer_challenge(mut self) -> Self {
        self.bearer_challenge = true;
        self
    }

    pub fn not_found(detail: impl Into<String>) -> Self {
        Self::new(ProblemCode::ResourceNotFound, detail)
    }

    pub fn database_unavailable() -> Self {
        Self::new(
            ProblemCode::DatabaseUnavailable,
            "The database is temporarily unable to serve this request.",
        )
        .retryable_in(2)
    }

    pub fn code(&self) -> ProblemCode {
        self.code
    }
}

/// Maps database failures onto client-visible problems.
///
/// A pool-acquisition timeout is retryable and gets its own code: it means the
/// service is saturated, not that the request was wrong. Everything else is an
/// internal error, logged with detail but reported without it, so that SQL
/// state never reaches a client.
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        match error {
            sqlx::Error::PoolTimedOut => {
                tracing::warn!("database pool acquisition timed out");
                Self::database_unavailable()
            }
            other => {
                tracing::error!(error = %other, "unexpected database error");
                Self::new(
                    ProblemCode::InternalError,
                    "The request could not be completed.",
                )
            }
        }
    }
}

impl From<crate::application::catalog::CatalogError> for ApiError {
    fn from(error: crate::application::catalog::CatalogError) -> Self {
        use crate::application::catalog::CatalogError;

        match error {
            CatalogError::MovieNotFound(id) => {
                Self::not_found(format!("Movie `{id}` does not exist."))
            }
            CatalogError::Database(error) => error.into(),
        }
    }
}

impl From<crate::application::tracks::TrackError> for ApiError {
    fn from(error: crate::application::tracks::TrackError) -> Self {
        use crate::application::tracks::TrackError;
        use crate::domain::track::InvalidInterval;

        match error {
            TrackError::SceneNotFound(id) => {
                Self::not_found(format!("Scene `{id}` does not exist."))
            }
            TrackError::SongNotFound(id) => Self::not_found(format!("Song `{id}` does not exist.")),
            TrackError::TrackNotFound(id) => {
                Self::not_found(format!("Track `{id}` does not exist."))
            }
            TrackError::MovieNotFound(id) => {
                Self::not_found(format!("Movie `{id}` does not exist."))
            }
            TrackError::SceneOutsideMovie { scene_id, movie_id } => Self::new(
                ProblemCode::SceneOutsideMovie,
                format!(
                    "Scene `{scene_id}` does not belong to movie `{movie_id}`. A track can only \
                     move between scenes of its own movie; create a new track instead."
                ),
            ),
            TrackError::InvalidInterval(invalid) => {
                // Bounds problems get their own code because a client can fix
                // them by adjusting the interval, unlike a generic validation
                // failure.
                let detail = match invalid {
                    InvalidInterval::NegativeStart => "`scene_start_ms` must not be negative.",
                    InvalidInterval::NotOrdered => {
                        "`scene_start_ms` must be less than `scene_end_ms`."
                    }
                    InvalidInterval::BeyondSceneEnd => {
                        "`scene_end_ms` must not exceed the scene duration."
                    }
                };
                Self::new(ProblemCode::TrackIntervalOutOfBounds, detail)
            }
            TrackError::InvalidStateTransition { from, to } => {
                let allowed = from
                    .allowed_transitions()
                    .iter()
                    .map(|state| state.as_str())
                    .collect::<Vec<_>>();

                // The detail names what *is* allowed, so a client can recover
                // without consulting the documentation.
                let detail = if allowed.is_empty() {
                    format!(
                        "`{}` is terminal; revise the track to start a new licensing proposition.",
                        from.as_str()
                    )
                } else {
                    format!(
                        "`{}` cannot become `{}`; allowed: {}.",
                        from.as_str(),
                        to.as_str(),
                        allowed.join(", ")
                    )
                };

                Self::new(ProblemCode::InvalidStateTransition, detail)
            }
            TrackError::VersionConflict { expected, actual } => Self::new(
                ProblemCode::VersionConflict,
                format!(
                    "`expected_version` was {expected} but the track is at version {actual}. \
                     Re-read the track and retry."
                ),
            ),
            TrackError::Database(error) => error.into(),
        }
    }
}

/// The wire representation. `type` is omitted rather than pointing at a URI
/// that does not resolve; RFC 9457 defines its default as `about:blank`.
#[derive(Debug, Serialize)]
struct ProblemBody<'a> {
    title: &'a str,
    status: u16,
    detail: &'a str,
    code: &'a str,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.code.status();

        let body = serde_json::to_vec(&ProblemBody {
            title: self.code.title(),
            status: status.as_u16(),
            detail: &self.detail,
            code: self.code.as_str(),
        })
        .expect("problem body is always serializable");

        let mut response = (status, body).into_response();
        response
            .headers_mut()
            .insert(header::CONTENT_TYPE, HeaderValue::from_static(PROBLEM_JSON));

        if self.bearer_challenge {
            response
                .headers_mut()
                .insert(header::WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
        }

        if let Some(seconds) = self.retry_after_seconds {
            response.headers_mut().insert(
                header::RETRY_AFTER,
                HeaderValue::from_str(&seconds.to_string())
                    .expect("retry-after is an ASCII integer"),
            );
        }

        response
    }
}

/// Fallback for unmatched routes, so a wrong path yields the API's own problem
/// shape instead of an empty framework 404.
pub async fn not_found_fallback() -> ApiError {
    ApiError::not_found("The requested resource does not exist.")
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    async fn body_json(error: ApiError) -> (StatusCode, Option<String>, serde_json::Value) {
        let response = error.into_response();
        let status = response.status();
        let retry_after = response
            .headers()
            .get(header::RETRY_AFTER)
            .map(|value| value.to_str().unwrap().to_string());
        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert_eq!(content_type, PROBLEM_JSON);

        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        (status, retry_after, serde_json::from_slice(&bytes).unwrap())
    }

    #[tokio::test]
    async fn renders_a_problem_document() {
        let (status, retry_after, body) = body_json(ApiError::not_found("No such track.")).await;

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(retry_after, None);
        assert_eq!(body["code"], "resource_not_found");
        assert_eq!(body["status"], 404);
        assert_eq!(body["detail"], "No such track.");
    }

    #[tokio::test]
    async fn retryable_problems_carry_retry_after() {
        let (status, retry_after, body) = body_json(ApiError::database_unavailable()).await;

        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(retry_after.as_deref(), Some("2"));
        assert_eq!(body["code"], "database_unavailable");
    }
}
