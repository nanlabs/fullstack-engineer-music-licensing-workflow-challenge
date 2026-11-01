//! Authentication middleware built with `actix_web::middleware::from_fn`.
//!
//! `authenticate` validates a JWT (Bearer header or access cookie) and keeps
//! its scopes for resource authorization. `authenticate_user_jwt` establishes
//! identity only (scopes stripped) for session endpoints. Both re-check the
//! user, tenant, credential version and session on every request so that a
//! suspension takes effect immediately.

use actix_web::body::MessageBody;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::http::header::AUTHORIZATION;
use actix_web::middleware::Next;
use actix_web::{web, HttpMessage};
use chrono::Utc;
use errx::AppError;
use kernel::{Actor, AuthContext};

use crate::Container;

pub async fn authenticate(
    container: web::Data<Container>,
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let ctx = read_jwt_identity(&container, &req).await?;
    req.extensions_mut().insert(ctx);
    next.call(req).await
}

pub async fn authenticate_user_jwt(
    container: web::Data<Container>,
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let mut ctx = read_jwt_identity(&container, &req).await?;
    ctx.scopes.clear();
    req.extensions_mut().insert(ctx);
    next.call(req).await
}

/// A non-empty Bearer credential wins over the cookie and does not fall back
/// to it when invalid.
fn extract_token(container: &Container, req: &ServiceRequest) -> Option<String> {
    let bearer = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned);
    if bearer.is_some() {
        return bearer;
    }
    req.cookie(&container.config.cookie.access_token_name)
        .map(|c| c.value().to_owned())
        .filter(|v| !v.is_empty())
}

async fn read_jwt_identity(container: &Container, req: &ServiceRequest) -> Result<AuthContext, AppError> {
    let token = extract_token(container, req).ok_or_else(AppError::unauthorized)?;
    let claims = container.jwt.validate(&token)?;

    let user = container
        .users
        .get_by_id(claims.tid, claims.sub)
        .await?
        .ok_or_else(AppError::unauthorized)?;
    if !user.can_login() || user.credential_version != claims.cv {
        return Err(AppError::unauthorized());
    }

    let tenant = container
        .tenants
        .get_by_id(claims.tid)
        .await?
        .ok_or_else(AppError::unauthorized)?;
    if !tenant.is_active() {
        return Err(AppError::unauthorized());
    }

    let now = Utc::now();
    match container.sessions.get(claims.sid).await? {
        Some(s) if s.is_active(now) && s.user_id == claims.sub && s.tenant_id == claims.tid => {
            // Activity tracking is best-effort and never fails authentication.
            if let Err(err) = container.sessions.touch(s.id).await {
                tracing::debug!(error = %err, "session touch failed");
            }
        }
        _ => return Err(AppError::unauthorized()),
    }

    Ok(AuthContext {
        actor: Actor::user(claims.sub),
        tenant_id: claims.tid,
        session_id: Some(claims.sid),
        email: Some(claims.email),
        name: Some(claims.name),
        scopes: claims.scopes,
    })
}
