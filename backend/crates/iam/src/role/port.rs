use async_trait::async_trait;
use errx::AppResult;
use kernel::{RoleId, TenantId, UserId};

use super::Role;

#[async_trait]
pub trait RoleRepository: Send + Sync {
    async fn get(&self, tenant_id: TenantId, id: RoleId) -> AppResult<Option<Role>>;
    async fn list(&self, tenant_id: TenantId) -> AppResult<Vec<Role>>;
    /// Fails with `ROLE_ALREADY_EXISTS` (409) on a duplicate name.
    async fn insert(&self, role: &Role) -> AppResult<()>;
    async fn update(&self, role: &Role) -> AppResult<Option<Role>>;
    async fn delete(&self, tenant_id: TenantId, id: RoleId) -> AppResult<bool>;
    async fn assign(&self, tenant_id: TenantId, role_id: RoleId, user_id: UserId) -> AppResult<()>;
    async fn unassign(&self, tenant_id: TenantId, role_id: RoleId, user_id: UserId) -> AppResult<bool>;
    async fn roles_for_user(&self, tenant_id: TenantId, user_id: UserId) -> AppResult<Vec<Role>>;
    /// Direct scopes plus the scopes of assigned roles, deduplicated.
    async fn effective_scopes(&self, tenant_id: TenantId, user_id: UserId) -> AppResult<Vec<String>>;
}
