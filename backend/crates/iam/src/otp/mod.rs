//! One-time passwords sent to an email address.
//!
//! An OTP proves ownership of a mailbox for a given purpose. It does not
//! prove tenant membership, which is checked separately by the auth flows.
//! Codes are stored hashed and compared in constant time; brute force is
//! bounded by `max_attempts`, not by the hash.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::OtpId;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum OtpPurpose {
    Signup,
    Login,
}

impl OtpPurpose {
    pub fn as_str(&self) -> &'static str {
        match self {
            OtpPurpose::Signup => "signup",
            OtpPurpose::Login => "login",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Otp {
    pub id: OtpId,
    pub contact: String,
    pub code_hash: Vec<u8>,
    pub purpose: OtpPurpose,
    pub expires_at: DateTime<Utc>,
    pub verified_at: Option<DateTime<Utc>>,
    pub attempts: i32,
    pub max_attempts: i32,
    pub created_at: DateTime<Utc>,
}

impl Otp {
    pub fn is_expired(&self, now: DateTime<Utc>) -> bool {
        now >= self.expires_at
    }

    pub fn is_verified(&self) -> bool {
        self.verified_at.is_some()
    }

    pub fn attempts_remaining(&self) -> i32 {
        (self.max_attempts - self.attempts).max(0)
    }

    /// Still usable: not expired, not consumed, attempts left.
    pub fn is_valid(&self, now: DateTime<Utc>) -> bool {
        !self.is_expired(now) && !self.is_verified() && self.attempts_remaining() > 0
    }

    pub fn seconds_until_expiry(&self, now: DateTime<Utc>) -> i64 {
        (self.expires_at - now).num_seconds().max(0)
    }
}

/// Hash bound to the contact and purpose so a code cannot be replayed for
/// another flow even if the row leaks.
pub fn hash_code(contact: &str, purpose: OtpPurpose, code: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(purpose.as_str().as_bytes());
    hasher.update(b"\x1f");
    hasher.update(normalize_contact(contact).as_bytes());
    hasher.update(b"\x1f");
    hasher.update(code.trim().as_bytes());
    hasher.finalize().to_vec()
}

pub fn normalize_contact(contact: &str) -> String {
    contact.trim().to_ascii_lowercase()
}

#[derive(Debug, thiserror::Error)]
pub enum OtpError {
    #[error("Invalid or incorrect code")]
    Invalid { attempts_remaining: i32 },
    #[error("The code has expired")]
    Expired,
    #[error("The code has already been used")]
    AlreadyUsed,
    #[error("Too many verification attempts")]
    TooManyAttempts,
    #[error("Too many code requests, try again later")]
    TooManyRequests { retry_after_secs: u64 },
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<OtpError> for AppError {
    fn from(err: OtpError) -> Self {
        let message = err.to_string();
        match err {
            OtpError::Invalid { attempts_remaining } => {
                AppError::new(errx::ErrorKind::Validation, "OTP_INVALID", message)
                    .detail("attempts_remaining", attempts_remaining)
            }
            OtpError::Expired => AppError::new(errx::ErrorKind::Validation, "OTP_EXPIRED", message),
            OtpError::AlreadyUsed => AppError::business("OTP_ALREADY_USED", message),
            OtpError::TooManyAttempts => AppError::rate_limited("OTP_TOO_MANY_ATTEMPTS", message),
            OtpError::TooManyRequests { retry_after_secs } => {
                AppError::rate_limited("OTP_TOO_MANY_REQUESTS", message).detail("retry_after", retry_after_secs)
            }
            OtpError::App(inner) => inner,
        }
    }
}
