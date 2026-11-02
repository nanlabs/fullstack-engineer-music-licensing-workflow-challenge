use async_trait::async_trait;
use errx::AppResult;
use kernel::TenantId;

use super::Tenant;

#[async_trait]
pub trait TenantRepository: Send + Sync {
    async fn get_by_id(&self, id: TenantId) -> AppResult<Option<Tenant>>;
    async fn get_by_slug(&self, slug: &str) -> AppResult<Option<Tenant>>;
}
