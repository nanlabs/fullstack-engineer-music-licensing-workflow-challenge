use async_trait::async_trait;
use errx::AppResult;
use kernel::{PageQuery, TenantId, UserId};

use super::User;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn get_by_id(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>>;
    async fn get_by_email(&self, tenant_id: TenantId, email: &str) -> AppResult<Option<User>>;
    /// Memberships of an email across tenants (used before login to pick a tenant).
    async fn find_by_email_across_tenants(&self, email: &str) -> AppResult<Vec<User>>;
    /// Returns a page of members and the total count for the tenant.
    async fn list(&self, tenant_id: TenantId, page: PageQuery) -> AppResult<(Vec<User>, u64)>;
    async fn update_scopes(&self, tenant_id: TenantId, id: UserId, scopes: &[String]) -> AppResult<Option<User>>;
    /// Suspends in one transaction: status, credential version bump, refresh
    /// tokens revoked and sessions expired. Returns `None` when not found.
    async fn suspend(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>>;
    /// Reinstates a suspended member. Old credentials are not restored.
    async fn reinstate(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>>;
    async fn record_login(&self, id: UserId) -> AppResult<()>;
}
