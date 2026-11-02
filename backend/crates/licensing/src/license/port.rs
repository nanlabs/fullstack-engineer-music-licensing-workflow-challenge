use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{TenantId, TrackId};

use super::{License, LicenseChanged, LicenseEvent};

/// Persistence contract of the workflow. The license row is created by the
/// track adapter (same transaction as the track) and read through
/// `TrackView`; this port only moves it and reads its history.
#[async_trait]
pub trait LicenseRepository: Send + Sync {
    /// Stores `license` (already at its new state and `version`) and appends
    /// `event` in one transaction, but only if the stored row is still at
    /// `license.version - 1`. Returns the tenant-wide `position` of the
    /// stored event (the cursor of the real-time stream); `None` means
    /// another transition won the race.
    async fn apply(&self, license: &License, event: &LicenseEvent) -> AppResult<Option<i64>>;
    /// The history of the track's license, oldest first.
    async fn list_events(&self, tenant_id: TenantId, track_id: TrackId) -> AppResult<Vec<LicenseEvent>>;
    /// The position of the tenant's latest event, `0` when there is none:
    /// where a stream opened without `Last-Event-ID` starts reading.
    async fn head_position(&self, tenant_id: TenantId) -> AppResult<i64>;
    /// The tenant's events after `position`, oldest first, each with the
    /// track as it reads *now*; at most `limit`. Events of a deleted track
    /// are gone with it. This is what a stream reads whenever the log grew
    /// and what a reconnecting one replays.
    async fn changes_since(&self, tenant_id: TenantId, after: i64, limit: i64) -> AppResult<Vec<LicenseChanged>>;
    /// Approved licenses whose term ended at or before `now`, across tenants:
    /// the trusted entry point of the expiry sweep, not of a request.
    async fn due_for_expiry(&self, now: DateTime<Utc>, limit: i64) -> AppResult<Vec<License>>;
}

/// Where a committed transition is announced so connected clients hear
/// about it. The service calls it *after* the transaction, never inside it,
/// and treats a failure as a warning: the event is already in
/// `license_events`, which is what a client replays when it reconnects.
/// Adapters: the in-process bus (`crate::events::bus::EventBus`) and the
/// Redis channel (`crate::events::infra::redis::RedisPublisher`).
#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: LicenseChanged) -> AppResult<()>;
}
