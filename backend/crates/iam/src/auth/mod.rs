//! Authentication: passwordless OTP flows, sessions, tokens and middleware.
//!
//! Signup requires an invitation token plus a `signup` OTP; login requires an
//! existing, active, OTP-enabled member plus a `login` OTP. Access tokens are
//! short-lived JWTs; refresh tokens are opaque, hashed, rotated on use and
//! bound to a session.

pub mod extract;
pub mod jwt;
pub mod middleware;
pub mod onboarding;
pub mod service;
pub mod session;
pub mod api {
    pub mod handlers;
}

use errx::{AppError, ErrorKind};
use kernel::{SessionId, TenantId, UserId};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::invitation::InvitationError;
use crate::otp::{OtpError, OtpPurpose};
use crate::tenant::{TenantError, TenantResponse};
use crate::user::{UserError, UserResponse, UserStatus};

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Invalid or expired refresh token")]
    InvalidRefreshToken,
    #[error("Session expired or revoked")]
    SessionExpired,
    #[error("Account is not active. Complete signup verification or contact an administrator")]
    AccountNotActive,
    #[error("Email address is not verified")]
    EmailNotVerified,
    #[error("This account cannot sign in with a one-time code")]
    OtpNotEnabled,
    #[error("Authentication failed")]
    Unauthorized,
    #[error(transparent)]
    Otp(#[from] OtpError),
    #[error(transparent)]
    Invitation(#[from] InvitationError),
    #[error(transparent)]
    Tenant(#[from] TenantError),
    #[error(transparent)]
    User(#[from] UserError),
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<AuthError> for AppError {
    fn from(err: AuthError) -> Self {
        let message = err.to_string();
        match err {
            AuthError::InvalidRefreshToken => {
                AppError::new(ErrorKind::Unauthorized, "AUTH_INVALID_REFRESH_TOKEN", message)
            }
            AuthError::SessionExpired => AppError::new(ErrorKind::Unauthorized, "AUTH_SESSION_EXPIRED", message),
            AuthError::AccountNotActive => AppError::new(ErrorKind::Forbidden, "AUTH_ACCOUNT_NOT_ACTIVE", message),
            AuthError::EmailNotVerified => AppError::new(ErrorKind::Forbidden, "AUTH_EMAIL_NOT_VERIFIED", message),
            AuthError::OtpNotEnabled => AppError::new(ErrorKind::Validation, "AUTH_OTP_NOT_ENABLED", message),
            AuthError::Unauthorized => AppError::new(ErrorKind::Unauthorized, "AUTH_FAILED", message),
            AuthError::Otp(inner) => inner.into(),
            AuthError::Invitation(inner) => inner.into(),
            AuthError::Tenant(inner) => inner.into(),
            AuthError::User(inner) => inner.into(),
            AuthError::App(inner) => inner,
        }
    }
}

/// Where the request came from, recorded on the session.
#[derive(Debug, Clone, Default)]
pub struct ClientInfo {
    pub ip_address: String,
    pub user_agent: String,
}

// --------------------------------------------------------------------------
// Request / response DTOs
// --------------------------------------------------------------------------

#[derive(Debug, Deserialize, Validate)]
pub struct MembershipsRequest {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthMethods {
    pub otp: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MembershipOption {
    pub tenant_id: TenantId,
    pub tenant_slug: String,
    pub tenant_name: String,
    pub user_status: UserStatus,
    pub auth_methods: AuthMethods,
}

#[derive(Debug, Clone, Serialize)]
pub struct MembershipsResponse {
    pub email: String,
    pub tenants: Vec<MembershipOption>,
    pub count: usize,
}

#[derive(Debug, Deserialize, Validate)]
pub struct InitiateSignupRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 2, max = 120))]
    pub name: String,
    #[validate(length(min = 16, max = 256))]
    pub invitation_token: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct InitiateSignupResponse {
    pub message: &'static str,
    pub email: String,
    pub tenant_id: TenantId,
    pub requires_otp: bool,
    pub expires_in_seconds: i64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct VerifySignupRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 2, max = 120))]
    pub name: String,
    #[validate(length(min = 16, max = 256))]
    pub invitation_token: String,
    pub tenant_id: TenantId,
    #[validate(length(min = 4, max = 10))]
    pub code: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerifySignupResponse {
    pub message: &'static str,
    pub tenant_id: TenantId,
    pub email: String,
    pub user_id: UserId,
}

#[derive(Debug, Deserialize, Validate)]
pub struct InitiateLoginRequest {
    #[validate(email)]
    pub email: String,
    pub tenant_id: TenantId,
}

#[derive(Debug, Clone, Serialize)]
pub struct InitiateLoginResponse {
    pub message: &'static str,
    pub email: String,
    pub expires_in_seconds: i64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct VerifyLoginRequest {
    #[validate(email)]
    pub email: String,
    pub tenant_id: TenantId,
    #[validate(length(min = 4, max = 10))]
    pub code: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResendOtpRequest {
    #[validate(email)]
    pub email: String,
    pub tenant_id: TenantId,
    pub purpose: OtpPurpose,
    #[validate(length(min = 16, max = 256))]
    pub invitation_token: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResendOtpResponse {
    pub message: &'static str,
    pub expires_in_seconds: i64,
}

#[derive(Debug, Default, Deserialize, Validate)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
}

/// Issued credentials. Also set as HttpOnly cookies by the handlers.
#[derive(Debug, Clone, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: &'static str,
    pub expires_in: u64,
    pub user: UserResponse,
    pub tenant: TenantResponse,
}

#[derive(Debug, Clone, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: &'static str,
    pub expires_in: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MeResponse {
    pub user: UserResponse,
    pub tenant: TenantResponse,
    pub effective_scopes: Vec<String>,
    pub session_id: Option<SessionId>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionsResponse {
    pub sessions: Vec<session::SessionResponse>,
    pub count: usize,
}
