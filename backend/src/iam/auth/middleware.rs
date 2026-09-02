use std::future::{Future, Ready, ready};
use std::pin::Pin;

use actix_web::dev::{Payload, Service, ServiceRequest, ServiceResponse, Transform, forward_ready};
use actix_web::web::Data;
use actix_web::{FromRequest, HttpRequest};

use crate::error::AppError;
use crate::iam::scopes;
use crate::kernel::UserId;

use super::error::AuthError;
use super::port::TokenService;

// ============================================================================
// AuthContext — extracted from JWT in request
// ============================================================================

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: UserId,
    pub email: String,
    pub name: String,
    pub scopes: Vec<String>,
}

impl AuthContext {
    pub fn has_scope(&self, scope: &str) -> bool {
        scopes::scopes_contain(&self.scopes, scope)
    }

    pub fn has_any_scope(&self, targets: &[&str]) -> bool {
        targets.iter().any(|s| self.has_scope(s))
    }

    pub fn has_all_scopes(&self, targets: &[&str]) -> bool {
        targets.iter().all(|s| self.has_scope(s))
    }

    pub fn require_scope(&self, scope: &str) -> Result<(), AppError> {
        if !self.has_scope(scope) {
            return Err(AuthError::access_denied().with_detail("required_scope", scope));
        }
        Ok(())
    }

    pub fn require_any_scope(&self, targets: &[&str]) -> Result<(), AppError> {
        if !self.has_any_scope(targets) {
            return Err(AuthError::access_denied()
                .with_detail("required_scopes", serde_json::json!(targets)));
        }
        Ok(())
    }
}

// ============================================================================
// Actix-web FromRequest extractor
// ============================================================================

impl FromRequest for AuthContext {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        ready(extract_auth(req).map_err(|e| e.into()))
    }
}

fn extract_auth(req: &HttpRequest) -> Result<AuthContext, AppError> {
    let token = extract_bearer_token(req).ok_or_else(AuthError::unauthorized)?;

    let token_svc = req
        .app_data::<Data<dyn TokenService>>()
        .ok_or_else(|| AppError::internal("TokenService not configured"))?;

    let claims = token_svc.validate_access_token(&token)?;

    Ok(AuthContext {
        user_id: claims.user_id,
        email: claims.email,
        name: claims.name,
        scopes: claims.scopes,
    })
}

fn extract_bearer_token(req: &HttpRequest) -> Option<String> {
    // Check Authorization: Bearer <token>
    if let Some(auth_header) = req.headers().get("Authorization")
        && let Ok(header_str) = auth_header.to_str()
        && let Some(token) = header_str.strip_prefix("Bearer ")
        && !token.is_empty()
    {
        return Some(token.to_string());
    }

    // Fallback to cookie
    if let Some(cookie) = req.cookie("access_token") {
        let value = cookie.value();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }

    None
}

// ============================================================================
// RequireScope middleware — route-level scope enforcement
// ============================================================================
//
// Usage:
//   web::scope("/users")
//       .wrap(RequireScope::new("movies:read"))
//       .route("", web::get().to(list_users))

pub struct RequireScope {
    scope: &'static str,
}

impl RequireScope {
    pub fn new(scope: &'static str) -> Self {
        Self { scope }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequireScope
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = actix_web::Error;
    type Transform = RequireScopeMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequireScopeMiddleware {
            service,
            scope: self.scope,
        }))
    }
}

pub struct RequireScopeMiddleware<S> {
    service: S,
    scope: &'static str,
}

impl<S, B> Service<ServiceRequest> for RequireScopeMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = actix_web::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        match extract_auth(req.request()).and_then(|auth| {
            auth.require_scope(self.scope)?;
            Ok(())
        }) {
            Err(e) => Box::pin(ready(Err(e.into()))),
            Ok(()) => Box::pin(self.service.call(req)),
        }
    }
}
