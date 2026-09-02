use actix_web::http::StatusCode;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorType {
    Internal,
    Validation,
    Authorization,
    NotFound,
    Conflict,
    Business,
    External,
}

impl ErrorType {
    pub fn http_status(&self) -> StatusCode {
        match self {
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Validation => StatusCode::BAD_REQUEST,
            Self::Authorization => StatusCode::UNAUTHORIZED,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::Business => StatusCode::UNPROCESSABLE_ENTITY,
            Self::External => StatusCode::BAD_GATEWAY,
        }
    }
}
