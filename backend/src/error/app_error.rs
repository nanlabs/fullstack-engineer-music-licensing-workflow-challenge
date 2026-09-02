use std::collections::HashMap;

use actix_web::HttpResponse;
use actix_web::ResponseError;
use actix_web::http::StatusCode;
use serde::Serialize;
use utoipa::ToSchema;

use super::ErrorType;

#[derive(Debug, thiserror::Error)]
#[error("[{code}] {message}")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub error_type: ErrorType,
    pub http_status: StatusCode,
    pub details: HashMap<String, serde_json::Value>,
}

/// Standard error body returned by every failing endpoint.
#[derive(Serialize, ToSchema)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub error_type: ErrorType,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    #[schema(value_type = Object)]
    pub details: HashMap<String, serde_json::Value>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, error_type: ErrorType) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            error_type,
            http_status: error_type.http_status(),
            details: HashMap::new(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL_ERROR", message, ErrorType::Internal)
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", message, ErrorType::Validation)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message, ErrorType::NotFound)
    }

    pub fn authorization(message: impl Into<String>) -> Self {
        Self::new("AUTHORIZATION_ERROR", message, ErrorType::Authorization)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new("CONFLICT", message, ErrorType::Conflict)
    }

    pub fn with_detail(
        mut self,
        key: impl Into<String>,
        value: impl Into<serde_json::Value>,
    ) -> Self {
        self.details.insert(key.into(), value.into());
        self
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        self.http_status
    }

    fn error_response(&self) -> HttpResponse {
        let (message, details) = if self.error_type == ErrorType::Internal {
            log::error!("[{}] {}", self.code, self.message);
            ("An internal error occurred".to_string(), HashMap::new())
        } else {
            (self.message.clone(), self.details.clone())
        };

        let body = ErrorResponse {
            code: self.code.clone(),
            message,
            error_type: self.error_type,
            details,
        };
        HttpResponse::build(self.http_status).json(body)
    }
}
