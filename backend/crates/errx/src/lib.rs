//! Errors are part of the API contract.
//!
//! Services return domain error enums (`thiserror`) and convert them into an
//! [`AppError`] with a stable `code`, an [`ErrorKind`] that decides the HTTP
//! status, and optional structured `details`. Infrastructure errors are
//! translated at the adapter boundary: a missing row becomes a domain
//! not-found error, never a raw `sqlx::Error` escaping to the client.

mod http;
mod validated;

use std::borrow::Cow;
use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use serde_json::{Map, Value};

pub use validated::ValidatedJson;

pub type AppResult<T> = Result<T, AppError>;

static EXPOSE_INTERNALS: AtomicBool = AtomicBool::new(false);

/// When enabled (development only), responses for internal errors include the
/// underlying error chain under `details.underlying_error`.
pub fn expose_internal_errors(enabled: bool) {
    EXPOSE_INTERNALS.store(enabled, Ordering::Relaxed);
}

fn internals_exposed() -> bool {
    EXPOSE_INTERNALS.load(Ordering::Relaxed)
}

/// Category of an error. It decides the HTTP status and how it is logged.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorKind {
    Validation,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    Business,
    RateLimited,
    External,
    Internal,
}

impl ErrorKind {
    pub fn http_status(self) -> u16 {
        match self {
            ErrorKind::Validation => 400,
            ErrorKind::Unauthorized => 401,
            ErrorKind::Forbidden => 403,
            ErrorKind::NotFound => 404,
            ErrorKind::Conflict => 409,
            ErrorKind::Business => 422,
            ErrorKind::RateLimited => 429,
            ErrorKind::External => 502,
            ErrorKind::Internal => 500,
        }
    }

    pub fn is_server_error(self) -> bool {
        self.http_status() >= 500
    }
}

/// A rich error with a stable code, a category and structured details.
#[derive(Debug)]
pub struct AppError {
    kind: ErrorKind,
    code: Cow<'static, str>,
    message: String,
    details: Map<String, Value>,
    source: Option<anyhow::Error>,
}

impl AppError {
    pub fn new(kind: ErrorKind, code: impl Into<Cow<'static, str>>, message: impl Into<String>) -> Self {
        Self {
            kind,
            code: code.into(),
            message: message.into(),
            details: Map::new(),
            source: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Validation, "VALIDATION_ERROR", message)
    }

    pub fn unauthorized() -> Self {
        Self::new(ErrorKind::Unauthorized, "UNAUTHORIZED", "Authentication required")
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Forbidden, "ACCESS_DENIED", message)
    }

    pub fn not_found(code: impl Into<Cow<'static, str>>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, code, message)
    }

    pub fn conflict(code: impl Into<Cow<'static, str>>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Conflict, code, message)
    }

    pub fn business(code: impl Into<Cow<'static, str>>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Business, code, message)
    }

    pub fn rate_limited(code: impl Into<Cow<'static, str>>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::RateLimited, code, message)
    }

    pub fn external(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::External, "EXTERNAL_ERROR", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, "INTERNAL_ERROR", message)
    }

    /// Attaches the underlying cause. It is logged, and only exposed to the
    /// client when [`expose_internal_errors`] is enabled.
    pub fn with_source(mut self, source: impl Into<anyhow::Error>) -> Self {
        self.source = Some(source.into());
        self
    }

    /// Adds a structured detail to the response body.
    pub fn detail(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        if let Ok(value) = serde_json::to_value(value) {
            self.details.insert(key.into(), value);
        }
        self
    }

    pub fn kind(&self) -> ErrorKind {
        self.kind
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn details(&self) -> &Map<String, Value> {
        &self.details
    }

    pub fn source_error(&self) -> Option<&anyhow::Error> {
        self.source.as_ref()
    }

    /// Serializable response body.
    pub fn to_body(&self) -> ErrorBody<'_> {
        let mut details = self.details.clone();
        if internals_exposed() {
            if let Some(source) = &self.source {
                details.insert("underlying_error".into(), Value::String(format!("{source:#}")));
            }
        }
        ErrorBody {
            error: ErrorPayload {
                code: &self.code,
                kind: self.kind,
                message: &self.message,
                details: if details.is_empty() { None } else { Some(details) },
            },
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)?;
        if let Some(source) = &self.source {
            write!(f, ": {source:#}")?;
        }
        Ok(())
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source
            .as_ref()
            .map(|e| e.as_ref() as &(dyn std::error::Error + 'static))
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorBody<'a> {
    pub error: ErrorPayload<'a>,
}

#[derive(Debug, Serialize)]
pub struct ErrorPayload<'a> {
    pub code: &'a str,
    pub kind: ErrorKind,
    pub message: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Map<String, Value>>,
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::internal("Database operation failed").with_source(err)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::internal("Unexpected internal error").with_source(err)
    }
}

impl From<validator::ValidationErrors> for AppError {
    fn from(errors: validator::ValidationErrors) -> Self {
        AppError::validation("Request validation failed").detail("fields", &errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn body_hides_source_unless_exposed() {
        let err = AppError::internal("boom").with_source(anyhow::anyhow!("db down"));
        let body = serde_json::to_value(err.to_body()).unwrap();
        assert_eq!(body["error"]["code"], "INTERNAL_ERROR");
        assert_eq!(body["error"]["kind"], "INTERNAL");
        assert!(body["error"].get("details").is_none());

        expose_internal_errors(true);
        let body = serde_json::to_value(err.to_body()).unwrap();
        assert_eq!(body["error"]["details"]["underlying_error"], "db down");
        expose_internal_errors(false);
    }

    #[test]
    fn details_are_serialized() {
        let err = AppError::rate_limited("OTP_TOO_MANY_REQUESTS", "slow down").detail("retry_after", 60);
        let body = serde_json::to_value(err.to_body()).unwrap();
        assert_eq!(body["error"]["details"]["retry_after"], 60);
        assert_eq!(err.kind().http_status(), 429);
    }
}
