use std::future::Future;
use std::ops::Deref;
use std::pin::Pin;

use actix_web::dev::Payload;
use actix_web::{web, FromRequest, HttpRequest};
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::AppError;

/// JSON body extractor that parses and then runs the DTO's `Validate` impl.
///
/// Handlers use it instead of `web::Json<T>` so that malformed bodies and
/// invalid fields both become a `VALIDATION_ERROR` response. Services call
/// `validate()` again on purpose: internal callers do not go through HTTP.
#[derive(Debug)]
pub struct ValidatedJson<T>(pub T);

impl<T> ValidatedJson<T> {
    pub fn into_inner(self) -> T {
        self.0
    }
}

impl<T> Deref for ValidatedJson<T> {
    type Target = T;

    fn deref(&self) -> &T {
        &self.0
    }
}

impl<T> FromRequest for ValidatedJson<T>
where
    T: DeserializeOwned + Validate + 'static,
{
    type Error = AppError;
    type Future = Pin<Box<dyn Future<Output = Result<Self, AppError>>>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let fut = web::Json::<T>::from_request(req, payload);
        Box::pin(async move {
            let json = fut
                .await
                .map_err(|e| AppError::validation(format!("Invalid request body: {e}")))?;
            json.validate()?;
            Ok(ValidatedJson(json.into_inner()))
        })
    }
}

#[cfg(test)]
mod tests {
    use actix_web::{http::StatusCode, test, web, App, HttpResponse};
    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Deserialize, Validate)]
    struct Body {
        #[validate(email)]
        email: String,
    }

    async fn handler(body: ValidatedJson<Body>) -> HttpResponse {
        HttpResponse::Ok().body(body.email.clone())
    }

    #[actix_web::test]
    async fn rejects_invalid_fields_with_details() {
        let app = test::init_service(App::new().route("/", web::post().to(handler))).await;
        let req = test::TestRequest::post()
            .uri("/")
            .set_json(serde_json::json!({ "email": "nope" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let json: serde_json::Value = test::read_body_json(resp).await;
        assert_eq!(json["error"]["code"], "VALIDATION_ERROR");
        assert!(json["error"]["details"]["fields"]["email"].is_array());
    }

    #[actix_web::test]
    async fn rejects_malformed_json() {
        let app = test::init_service(App::new().route("/", web::post().to(handler))).await;
        let req = test::TestRequest::post()
            .uri("/")
            .insert_header(("content-type", "application/json"))
            .set_payload("{not json")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[actix_web::test]
    async fn accepts_valid_body() {
        let app = test::init_service(App::new().route("/", web::post().to(handler))).await;
        let req = test::TestRequest::post()
            .uri("/")
            .set_json(serde_json::json!({ "email": "a@b.co" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
