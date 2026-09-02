use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::kernel::UserId;

// ============================================================================
// User Sessions — represents a login from a specific device/browser
// ============================================================================

#[derive(Debug, Clone)]
pub struct UserSession {
    pub id: String,
    pub user_id: UserId,
    pub ip_address: String,
    pub user_agent: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

impl UserSession {
    pub fn new(
        user_id: UserId,
        ip_address: String,
        user_agent: String,
        ttl: std::time::Duration,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            user_id,
            ip_address,
            user_agent,
            expires_at: now + ttl,
            created_at: now,
            last_activity: now,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn is_valid(&self) -> bool {
        !self.is_expired()
    }
}

// ============================================================================
// Refresh Tokens — belongs to a session, rotates within it
// ============================================================================

#[derive(Debug, Clone)]
pub struct RefreshToken {
    pub id: String,
    pub token: String,
    pub user_id: UserId,
    pub session_id: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub is_revoked: bool,
}

impl RefreshToken {
    pub fn new(
        user_id: UserId,
        session_id: String,
        token: String,
        ttl: std::time::Duration,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            token,
            user_id,
            session_id,
            expires_at: now + ttl,
            created_at: now,
            is_revoked: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn is_valid(&self) -> bool {
        !self.is_revoked && !self.is_expired()
    }
}

/// Metadata about the login request (IP, user agent)
#[derive(Debug, Clone, Default)]
pub struct LoginMetadata {
    pub ip_address: String,
    pub user_agent: String,
}

// ============================================================================
// Token Claims (domain type — not the JWT representation)
// ============================================================================

#[derive(Debug, Clone)]
pub struct TokenClaims {
    pub user_id: UserId,
    pub email: String,
    pub name: String,
    pub scopes: Vec<String>,
}

// ============================================================================
// OAuth Types
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct OAuthUserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    pub email_verified: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}
