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
    ResourceNotFound,
    DatabaseUnavailable,
    ValidationFailed,
    InternalError,
}

impl ProblemCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ResourceNotFound => "resource_not_found",
            Self::DatabaseUnavailable => "database_unavailable",
            Self::ValidationFailed => "validation_failed",
            Self::InternalError => "internal_error",
        }
    }

    fn status(self) -> StatusCode {
        match self {
            Self::ResourceNotFound => StatusCode::NOT_FOUND,
            Self::DatabaseUnavailable => StatusCode::SERVICE_UNAVAILABLE,
            Self::ValidationFailed => StatusCode::UNPROCESSABLE_ENTITY,
            Self::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::ResourceNotFound => "Resource not found",
            Self::DatabaseUnavailable => "Database unavailable",
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
}

impl ApiError {
    pub fn new(code: ProblemCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
            retry_after_seconds: None,
        }
    }

    pub fn retryable_in(mut self, seconds: u32) -> Self {
        self.retry_after_seconds = Some(seconds);
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
