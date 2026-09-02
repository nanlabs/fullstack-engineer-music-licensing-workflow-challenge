use actix_web::{HttpRequest, HttpResponse, web};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;

use super::middleware::AuthContext;
use super::model::LoginMetadata;
use super::service::AuthService;

// ============================================================================
// Request / Response DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RefreshBody {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LogoutBody {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    pub user_id: String,
    pub email: String,
    pub name: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionResponse {
    pub id: String,
    pub ip_address: String,
    pub user_agent: String,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MessageResponse {
    pub message: String,
}

// ============================================================================
// Handlers
// ============================================================================

fn extract_meta(req: &HttpRequest) -> LoginMetadata {
    let ip_address = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    let user_agent = req
        .headers()
        .get("User-Agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    LoginMetadata {
        ip_address,
        user_agent,
    }
}

/// Log in with email and password
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "Auth",
    request_body = LoginBody,
    responses(
        (status = 200, description = "Login successful", body = TokenResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Invalid credentials", body = crate::error::ErrorResponse),
    )
)]
pub async fn login(
    req: HttpRequest,
    auth_svc: web::Data<AuthService>,
    body: web::Json<LoginBody>,
) -> Result<HttpResponse, AppError> {
    let meta = extract_meta(&req);
    let body = body.into_inner();

    let pair = auth_svc
        .login_with_password(
            super::model::LoginRequest {
                email: body.email,
                password: body.password,
            },
            meta,
        )
        .await?;

    Ok(HttpResponse::Ok().json(TokenResponse {
        access_token: pair.access_token,
        refresh_token: pair.refresh_token,
        token_type: pair.token_type,
        expires_in: pair.expires_in,
    }))
}

/// Refresh an access token
#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    tag = "Auth",
    request_body = RefreshBody,
    responses(
        (status = 200, description = "Tokens refreshed", body = TokenResponse),
        (status = 401, description = "Invalid or expired refresh token", body = crate::error::ErrorResponse),
    )
)]
pub async fn refresh(
    auth_svc: web::Data<AuthService>,
    body: web::Json<RefreshBody>,
) -> Result<HttpResponse, AppError> {
    let pair = auth_svc.refresh_tokens(&body.refresh_token).await?;

    Ok(HttpResponse::Ok().json(TokenResponse {
        access_token: pair.access_token,
        refresh_token: pair.refresh_token,
        token_type: pair.token_type,
        expires_in: pair.expires_in,
    }))
}

/// Log out (revoke a single refresh token)
#[utoipa::path(
    post,
    path = "/api/auth/logout",
    tag = "Auth",
    request_body = LogoutBody,
    responses(
        (status = 200, description = "Logged out", body = MessageResponse),
    )
)]
pub async fn logout(
    auth_svc: web::Data<AuthService>,
    body: web::Json<LogoutBody>,
) -> Result<HttpResponse, AppError> {
    auth_svc.logout(&body.refresh_token).await?;

    Ok(HttpResponse::Ok().json(MessageResponse {
        message: "Logged out successfully".into(),
    }))
}

/// Log out of all sessions (revoke all refresh tokens)
#[utoipa::path(
    post,
    path = "/api/auth/logout-all",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "All sessions revoked", body = MessageResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn logout_all(
    auth: AuthContext,
    auth_svc: web::Data<AuthService>,
) -> Result<HttpResponse, AppError> {
    auth_svc.logout_all(&auth.user_id).await?;

    Ok(HttpResponse::Ok().json(MessageResponse {
        message: "All sessions revoked".into(),
    }))
}

/// Get the authenticated user's profile
#[utoipa::path(
    get,
    path = "/api/auth/me",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current user", body = MeResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn me(auth: AuthContext) -> Result<HttpResponse, AppError> {
    Ok(HttpResponse::Ok().json(MeResponse {
        user_id: auth.user_id.to_string(),
        email: auth.email,
        name: auth.name,
        scopes: auth.scopes,
    }))
}

/// List active sessions for the authenticated user
#[utoipa::path(
    get,
    path = "/api/auth/sessions",
    tag = "Auth",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Active sessions", body = Vec<SessionResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_sessions(
    auth: AuthContext,
    auth_svc: web::Data<AuthService>,
) -> Result<HttpResponse, AppError> {
    let sessions = auth_svc.list_user_sessions(&auth.user_id).await?;

    let response: Vec<SessionResponse> = sessions
        .into_iter()
        .map(|s| SessionResponse {
            id: s.id,
            ip_address: s.ip_address,
            user_agent: s.user_agent,
            created_at: s.created_at,
            last_activity: s.last_activity,
            expires_at: s.expires_at,
        })
        .collect();

    Ok(HttpResponse::Ok().json(response))
}

/// Revoke a specific session
#[utoipa::path(
    delete,
    path = "/api/auth/sessions/{id}",
    tag = "Auth",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Session id")),
    responses(
        (status = 200, description = "Session revoked", body = MessageResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Session not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn revoke_session(
    auth: AuthContext,
    auth_svc: web::Data<AuthService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let session_id = path.into_inner();

    // Verify the session belongs to the authenticated user
    let sessions = auth_svc.list_user_sessions(&auth.user_id).await?;
    if !sessions.iter().any(|s| s.id == session_id) {
        return Err(AppError::not_found("Session not found"));
    }

    auth_svc.revoke_session(&session_id).await?;

    Ok(HttpResponse::Ok().json(MessageResponse {
        message: "Session revoked".into(),
    }))
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/login", web::post().to(login))
            .route("/refresh", web::post().to(refresh))
            .route("/logout", web::post().to(logout))
            .route("/logout-all", web::post().to(logout_all))
            .route("/me", web::get().to(me))
            .route("/sessions", web::get().to(list_sessions))
            .route("/sessions/{id}", web::delete().to(revoke_session)),
    );
}
