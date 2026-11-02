use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{InvitationId, PageQuery, TenantId};

use super::{Invitation, InvitationFilter, InvitationStatus};

#[async_trait]
pub trait InvitationRepository: Send + Sync {
    /// Fails with `INVITATION_ALREADY_PENDING` (409) when a pending one exists.
    async fn insert(&self, invitation: &Invitation) -> AppResult<()>;
    async fn get(&self, tenant_id: TenantId, id: InvitationId) -> AppResult<Option<Invitation>>;
    /// Token lookup is global: the token identifies the tenant.
    async fn get_by_token_hash(&self, token_hash: &[u8]) -> AppResult<Option<Invitation>>;
    async fn list(
        &self,
        tenant_id: TenantId,
        filter: &InvitationFilter,
        page: PageQuery,
    ) -> AppResult<(Vec<Invitation>, u64)>;
    /// Marks pending invitations past their expiry as expired so a new one can be created.
    async fn expire_stale(&self, tenant_id: TenantId, email: &str) -> AppResult<u64>;
    async fn set_status(
        &self,
        tenant_id: TenantId,
        id: InvitationId,
        status: InvitationStatus,
    ) -> AppResult<Option<Invitation>>;
    /// Replaces the token and extends the expiry of a pending invitation.
    async fn rotate_token(
        &self,
        tenant_id: TenantId,
        id: InvitationId,
        token_hash: &[u8],
        expires_at: DateTime<Utc>,
    ) -> AppResult<Option<Invitation>>;
}

/// Everything a channel needs to deliver an invitation. The raw token exists
/// only here and in the message that leaves the system; the store keeps a
/// hash. Names are resolved by the service so adapters never touch
/// repositories.
#[derive(Debug, Clone)]
pub struct InvitationDelivery {
    pub email: String,
    pub token: String,
    pub tenant_id: TenantId,
    pub tenant_name: String,
    pub invited_by_name: String,
    pub expires_at: DateTime<Utc>,
}

/// Delivery channel for invitation tokens. The adapters live in the `notifx`
/// crate (console today; email implements the same trait).
#[async_trait]
pub trait InvitationNotifier: Send + Sync {
    async fn send_invitation(&self, delivery: &InvitationDelivery) -> AppResult<()>;
}
