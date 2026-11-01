use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{InvitationId, PageQuery, TenantId, UserId};

use super::{Invitation, InvitationStatus};

#[async_trait]
pub trait InvitationRepository: Send + Sync {
    /// Fails with `INVITATION_ALREADY_PENDING` (409) when a pending one exists.
    async fn insert(&self, invitation: &Invitation) -> AppResult<()>;
    async fn get(&self, tenant_id: TenantId, id: InvitationId) -> AppResult<Option<Invitation>>;
    /// Token lookup is global: the token identifies the tenant.
    async fn get_by_token_hash(&self, token_hash: &[u8]) -> AppResult<Option<Invitation>>;
    async fn list(&self, tenant_id: TenantId, page: PageQuery) -> AppResult<(Vec<Invitation>, u64)>;
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

/// Delivery channel for invitation tokens.
#[async_trait]
pub trait InvitationNotifier: Send + Sync {
    async fn send_invitation(&self, email: &str, token: &str, tenant_id: TenantId, invited_by: UserId)
        -> AppResult<()>;
}
