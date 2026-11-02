//! Invitations are the only way into a tenant. An authorized member invites
//! an email with direct scopes and/or a role; the invitee proves mailbox
//! ownership with an OTP and acceptance commits membership atomically.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use base64::Engine as _;
use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{InvitationId, RoleId, TenantId, UserId};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use validator::Validate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum InvitationStatus {
    Pending,
    Accepted,
    Revoked,
    Expired,
}

impl InvitationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            InvitationStatus::Pending => "pending",
            InvitationStatus::Accepted => "accepted",
            InvitationStatus::Revoked => "revoked",
            InvitationStatus::Expired => "expired",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Invitation {
    pub id: InvitationId,
    pub tenant_id: TenantId,
    pub email: String,
    /// SHA-256 of the raw token. The raw token only ever reaches the notifier.
    pub token_hash: Vec<u8>,
    pub scopes: Vec<String>,
    pub role_id: Option<RoleId>,
    pub invited_by: UserId,
    pub status: InvitationStatus,
    pub expires_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub accepted_user_id: Option<UserId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Invitation {
    pub fn is_expired(&self, now: DateTime<Utc>) -> bool {
        now >= self.expires_at
    }

    pub fn can_be_accepted(&self, now: DateTime<Utc>) -> bool {
        self.status == InvitationStatus::Pending && !self.is_expired(now)
    }

    pub fn matches_email(&self, email: &str) -> bool {
        self.email.eq_ignore_ascii_case(email.trim())
    }
}

/// `GET /invitations?status=` filter.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct InvitationFilter {
    pub status: Option<InvitationStatus>,
}

/// What the invitee sees before proving the mailbox (public, by token).
/// Deliberately small: no scopes, no role, no ids beyond the tenant.
#[derive(Debug, Clone, Serialize)]
pub struct InvitationPreview {
    pub email: String,
    pub tenant_id: TenantId,
    pub tenant_name: String,
    pub invited_by_name: String,
    pub expires_at: DateTime<Utc>,
}

/// Response DTO. Never includes the token.
#[derive(Debug, Clone, Serialize)]
pub struct InvitationResponse {
    pub id: InvitationId,
    pub tenant_id: TenantId,
    pub email: String,
    pub scopes: Vec<String>,
    pub role_id: Option<RoleId>,
    pub invited_by: UserId,
    pub status: InvitationStatus,
    pub expires_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<&Invitation> for InvitationResponse {
    fn from(i: &Invitation) -> Self {
        Self {
            id: i.id,
            tenant_id: i.tenant_id,
            email: i.email.clone(),
            scopes: i.scopes.clone(),
            role_id: i.role_id,
            invited_by: i.invited_by,
            status: i.status,
            expires_at: i.expires_at,
            accepted_at: i.accepted_at,
            created_at: i.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateInvitationResponse {
    #[serde(flatten)]
    pub invitation: InvitationResponse,
    /// False when the notifier failed; the invitation stays pending and can be resent.
    pub delivered: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateInvitationRequest {
    #[validate(email)]
    pub email: String,
    #[serde(default)]
    #[validate(length(max = 100))]
    pub scopes: Vec<String>,
    pub role_id: Option<RoleId>,
}

#[derive(Debug, thiserror::Error)]
pub enum InvitationError {
    #[error("Invitation not found")]
    NotFound,
    #[error("Invitation is invalid, expired or already used")]
    Invalid,
    #[error("Operation requires a pending invitation")]
    NotPending,
    #[error("Role not found")]
    RoleNotFound,
    #[error("This member cannot be invited")]
    MemberNotEligible,
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<InvitationError> for AppError {
    fn from(err: InvitationError) -> Self {
        let message = err.to_string();
        match err {
            InvitationError::NotFound => AppError::not_found("INVITATION_NOT_FOUND", message),
            InvitationError::Invalid => AppError::new(errx::ErrorKind::Validation, "INVITATION_INVALID", message),
            InvitationError::NotPending => AppError::business("INVITATION_NOT_PENDING", message),
            InvitationError::RoleNotFound => AppError::not_found("ROLE_NOT_FOUND", message),
            InvitationError::MemberNotEligible => AppError::business("INVITATION_MEMBER_NOT_ELIGIBLE", message),
            InvitationError::App(inner) => inner,
        }
    }
}

/// Returns `(raw_token, token_hash)`.
pub fn generate_token() -> Result<(String, Vec<u8>), AppError> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|e| AppError::internal("Random generator unavailable").with_source(anyhow::anyhow!(e)))?;
    let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
    let hash = hash_token(&raw);
    Ok((raw, hash))
}

pub fn hash_token(raw: &str) -> Vec<u8> {
    Sha256::digest(raw.trim().as_bytes()).to_vec()
}
