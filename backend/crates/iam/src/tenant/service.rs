use std::sync::Arc;

use kernel::{AuthContext, TenantId};

use super::port::TenantRepository;
use super::{Tenant, TenantError, TenantResponse};
use crate::{authz, scopes};

pub struct TenantService {
    repo: Arc<dyn TenantRepository>,
}

impl TenantService {
    pub fn new(repo: Arc<dyn TenantRepository>) -> Self {
        Self { repo }
    }

    /// The caller's own tenant.
    pub async fn get_mine(&self, ctx: &AuthContext) -> Result<TenantResponse, TenantError> {
        authz::require(ctx, ctx.tenant_id, scopes::TENANTS_READ)?;
        let tenant = self.load_active(ctx.tenant_id).await?;
        Ok(TenantResponse::from(&tenant))
    }

    /// Trusted lookup used by authentication flows (no caller context yet).
    pub async fn load_active(&self, id: TenantId) -> Result<Tenant, TenantError> {
        let tenant = self.repo.get_by_id(id).await?.ok_or(TenantError::NotFound)?;
        if !tenant.is_active() {
            return Err(TenantError::Suspended);
        }
        Ok(tenant)
    }
}
