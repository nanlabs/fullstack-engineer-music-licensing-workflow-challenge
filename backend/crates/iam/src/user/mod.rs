//! Tenant members. There is no public `POST /users`: membership is created
//! through verified onboarding (invitation + OTP). Status changes are explicit
//! operations, never a side effect of a generic update.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{TenantId, UserId};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum UserStatus {
    Pending,
    Active,
    Suspended,
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: UserId,
    pub tenant_id: TenantId,
    pub email: String,
    pub name: String,
    pub status: UserStatus,
    /// Direct grants. Effective scopes also include assigned roles.
    pub scopes: Vec<String>,
    /// Bumped on suspension so outstanding tokens stop working.
    pub credential_version: i64,
    pub email_verified: bool,
    pub otp_enabled: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn is_active(&self) -> bool {
        self.status == UserStatus::Active
    }

    pub fn is_pending(&self) -> bool {
        self.status == UserStatus::Pending
    }

    pub fn can_login(&self) -> bool {
        self.is_active()
    }

    pub fn can_login_with_otp(&self) -> bool {
        self.can_login() && self.otp_enabled && self.email_verified
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct UserResponse {
    pub id: UserId,
    pub tenant_id: TenantId,
    pub email: String,
    pub name: String,
    pub status: UserStatus,
    pub scopes: Vec<String>,
    pub email_verified: bool,
    pub otp_enabled: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<&User> for UserResponse {
    fn from(u: &User) -> Self {
        Self {
            id: u.id,
            tenant_id: u.tenant_id,
            email: u.email.clone(),
            name: u.name.clone(),
            status: u.status,
            scopes: u.scopes.clone(),
            email_verified: u.email_verified,
            otp_enabled: u.otp_enabled,
            last_login_at: u.last_login_at,
            created_at: u.created_at,
        }
    }
}

/// Replaces the member's direct scopes. An empty array clears direct grants
/// without touching permissions inherited from roles.
#[derive(Debug, Deserialize, Validate)]
pub struct SetScopesRequest {
    #[validate(length(max = 100))]
    pub scopes: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found")]
    NotFound,
    #[error("Operation not allowed for a user in status '{current}'")]
    InvalidStatus { current: String },
    #[error("You cannot change your own account status")]
    CannotModifySelf,
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<UserError> for AppError {
    fn from(err: UserError) -> Self {
        match err {
            UserError::NotFound => AppError::not_found("USER_NOT_FOUND", err.to_string()),
            UserError::InvalidStatus { .. } => AppError::business("USER_INVALID_STATUS", err.to_string()),
            UserError::CannotModifySelf => AppError::business("USER_CANNOT_MODIFY_SELF", err.to_string()),
            UserError::App(inner) => inner,
        }
    }
}

pub fn normalize_scopes(scopes: &[String]) -> Vec<String> {
    let mut out: Vec<String> = scopes
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    out.sort();
    out.dedup();
    out
}
