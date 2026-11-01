use std::future::{ready, Ready};
use std::ops::Deref;

use actix_web::dev::Payload;
use actix_web::{FromRequest, HttpMessage, HttpRequest};
use errx::AppError;
use kernel::AuthContext;

/// Extractor for the context stored by the authentication middleware.
///
/// Handlers declare `auth: Auth` and pass `&auth` to services (it derefs to
/// [`AuthContext`]). A route without the middleware gets a 401 instead of a
/// fabricated context.
#[derive(Debug, Clone)]
pub struct Auth(pub AuthContext);

impl Deref for Auth {
    type Target = AuthContext;

    fn deref(&self) -> &AuthContext {
        &self.0
    }
}

impl FromRequest for Auth {
    type Error = AppError;
    type Future = Ready<Result<Self, AppError>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let ctx = req.extensions().get::<AuthContext>().cloned();
        ready(ctx.map(Auth).ok_or_else(AppError::unauthorized))
    }
}
