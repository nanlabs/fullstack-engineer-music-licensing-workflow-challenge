//! Sessions (one per device) and the refresh tokens bound to them.

pub mod port;
pub mod infra {
    pub mod postgres;
}

use base64::Engine as _;
use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{SessionId, TenantId, UserId};
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Session {
    pub id: SessionId,
    pub user_id: UserId,
    pub tenant_id: TenantId,
    pub ip_address: String,
    pub user_agent: String,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
}

impl Session {
    pub fn is_active(&self, now: DateTime<Utc>) -> bool {
        self.revoked_at.is_none() && now < self.expires_at
    }
}

/// Opaque refresh credential. Only its hash is stored; a token is bound to a
/// session and to the user's credential version at issuance.
#[derive(Debug, Clone)]
pub struct RefreshToken {
    pub id: Uuid,
    pub token_hash: Vec<u8>,
    pub user_id: UserId,
    pub tenant_id: TenantId,
    pub session_id: SessionId,
    pub credential_version: i64,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl RefreshToken {
    pub fn is_expired(&self, now: DateTime<Utc>) -> bool {
        now >= self.expires_at
    }

    pub fn is_revoked(&self) -> bool {
        self.revoked_at.is_some()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionResponse {
    pub id: SessionId,
    pub ip_address: String,
    pub user_agent: String,
    pub created_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub current: bool,
}

impl SessionResponse {
    pub fn from_session(s: &Session, current: Option<SessionId>) -> Self {
        Self {
            id: s.id,
            ip_address: s.ip_address.clone(),
            user_agent: s.user_agent.clone(),
            created_at: s.created_at,
            last_activity_at: s.last_activity_at,
            expires_at: s.expires_at,
            current: current == Some(s.id),
        }
    }
}

/// Returns `(raw_token, token_hash)`.
pub fn generate_refresh_token() -> Result<(String, Vec<u8>), AppError> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|e| AppError::internal("Random generator unavailable").with_source(anyhow::anyhow!(e)))?;
    let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
    let hash = hash_refresh_token(&raw);
    Ok((raw, hash))
}

pub fn hash_refresh_token(raw: &str) -> Vec<u8> {
    Sha256::digest(raw.trim().as_bytes()).to_vec()
}
