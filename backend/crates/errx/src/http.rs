use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};

use crate::AppError;

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        StatusCode::from_u16(self.kind().http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
    }

    fn error_response(&self) -> HttpResponse {
        if self.kind().is_server_error() {
            tracing::error!(code = self.code(), error = %self, "request failed");
        } else {
            tracing::debug!(code = self.code(), error = %self, "request rejected");
        }
        HttpResponse::build(self.status_code()).json(self.to_body())
    }
}

#[cfg(test)]
mod tests {
    use actix_web::body::to_bytes;

    use super::*;
    use crate::ErrorKind;

    #[actix_web::test]
    async fn maps_kind_to_status_and_json_body() {
        let err = AppError::new(ErrorKind::Conflict, "USER_ALREADY_EXISTS", "exists");
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::CONFLICT);
        let bytes = to_bytes(resp.into_body()).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["error"]["code"], "USER_ALREADY_EXISTS");
        assert_eq!(json["error"]["kind"], "CONFLICT");
    }
}
