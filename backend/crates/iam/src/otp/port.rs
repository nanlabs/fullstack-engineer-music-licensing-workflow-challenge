use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::OtpId;

use super::{Otp, OtpPurpose};

#[async_trait]
pub trait OtpRepository: Send + Sync {
    async fn insert(&self, otp: &Otp) -> AppResult<()>;
    /// Most recent code for a contact and purpose, regardless of state.
    async fn latest_by_contact(&self, contact: &str, purpose: OtpPurpose) -> AppResult<Option<Otp>>;
    /// Atomically counts one attempt and, when `verified`, consumes the code.
    /// Returns `None` if the code was already consumed or exhausted by a
    /// concurrent request.
    async fn record_attempt(&self, id: OtpId, verified: bool) -> AppResult<Option<Otp>>;
    async fn delete_expired(&self) -> AppResult<u64>;
}

/// Everything a channel needs to deliver a code. The raw code exists only
/// here and in the message that leaves the system; the store keeps a hash.
#[derive(Debug, Clone)]
pub struct OtpDelivery {
    pub contact: String,
    pub code: String,
    pub purpose: OtpPurpose,
    pub expires_at: DateTime<Utc>,
}

/// Delivery channel for codes. The adapters live in the `notifx` crate
/// (console today; email implements the same trait).
#[async_trait]
pub trait OtpNotifier: Send + Sync {
    async fn send_otp(&self, delivery: &OtpDelivery) -> AppResult<()>;
}
