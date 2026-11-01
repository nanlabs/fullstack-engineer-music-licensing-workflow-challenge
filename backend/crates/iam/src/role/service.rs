use std::sync::Arc;

use chrono::Utc;
use kernel::{AuthContext, RoleId, UserId};
use validator::Validate;

use super::port::RoleRepository;
use super::{
    AssignRoleRequest, CreateRoleRequest, Role, RoleError, RoleResponse, UpdateRoleRequest, UserRolesResponse,
};
use crate::user::normalize_scopes;
use crate::user::port::UserRepository;
use crate::{authz, scopes};

pub struct RoleService {
    roles: Arc<dyn RoleRepository>,
    users: Arc<dyn UserRepository>,
}

impl RoleService {
    pub fn new(roles: Arc<dyn RoleRepository>, users: Arc<dyn UserRepository>) -> Self {
        Self { roles, users }
    }

    pub async fn list(&self, ctx: &AuthContext) -> Result<Vec<RoleResponse>, RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_READ)?;
        let roles = self.roles.list(ctx.tenant_id).await?;
        Ok(roles.iter().map(RoleResponse::from).collect())
    }

    pub async fn get(&self, ctx: &AuthContext, id: RoleId) -> Result<RoleResponse, RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_READ)?;
        let role = self.load(ctx, id).await?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn create(&self, ctx: &AuthContext, req: CreateRoleRequest) -> Result<RoleResponse, RoleError> {
        req.validate().map_err(errx::AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_WRITE)?;
        let granted = normalize_scopes(&req.scopes);
        scopes::validate_grantable(&granted)?;
        scopes::ensure_can_grant(ctx, &granted)?;

        let now = Utc::now();
        let role = Role {
            id: RoleId::generate(),
            tenant_id: ctx.tenant_id,
            name: req.name.trim().to_string(),
            description: req.description.trim().to_string(),
            scopes: granted,
            created_at: now,
            updated_at: now,
        };
        self.roles.insert(&role).await?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn update(
        &self,
        ctx: &AuthContext,
        id: RoleId,
        req: UpdateRoleRequest,
    ) -> Result<RoleResponse, RoleError> {
        req.validate().map_err(errx::AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_WRITE)?;
        let mut role = self.load(ctx, id).await?;
        if let Some(name) = req.name {
            role.name = name.trim().to_string();
        }
        if let Some(description) = req.description {
            role.description = description.trim().to_string();
        }
        if let Some(requested) = req.scopes {
            let granted = normalize_scopes(&requested);
            scopes::validate_grantable(&granted)?;
            scopes::ensure_can_grant(ctx, &granted)?;
            role.scopes = granted;
        }
        role.updated_at = Utc::now();
        let role = self.roles.update(&role).await?.ok_or(RoleError::NotFound)?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn delete(&self, ctx: &AuthContext, id: RoleId) -> Result<(), RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_WRITE)?;
        if self.roles.delete(ctx.tenant_id, id).await? {
            Ok(())
        } else {
            Err(RoleError::NotFound)
        }
    }

    pub async fn assign(&self, ctx: &AuthContext, id: RoleId, req: AssignRoleRequest) -> Result<(), RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_ASSIGN)?;
        let role = self.load(ctx, id).await?;
        // Assigning a role grants its scopes: the caller must hold them.
        scopes::ensure_can_grant(ctx, &role.scopes)?;
        self.ensure_member(ctx, req.user_id).await?;
        self.roles.assign(ctx.tenant_id, id, req.user_id).await?;
        Ok(())
    }

    pub async fn unassign(&self, ctx: &AuthContext, id: RoleId, user_id: UserId) -> Result<(), RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_ASSIGN)?;
        self.load(ctx, id).await?;
        if self.roles.unassign(ctx.tenant_id, id, user_id).await? {
            Ok(())
        } else {
            Err(RoleError::UserNotFound)
        }
    }

    pub async fn user_roles(&self, ctx: &AuthContext, user_id: UserId) -> Result<UserRolesResponse, RoleError> {
        authz::require(ctx, ctx.tenant_id, scopes::ROLES_READ)?;
        let user = self.ensure_member(ctx, user_id).await?;
        let roles = self.roles.roles_for_user(ctx.tenant_id, user_id).await?;
        let effective = self.roles.effective_scopes(ctx.tenant_id, user_id).await?;
        Ok(UserRolesResponse {
            user_id,
            roles: roles.iter().map(RoleResponse::from).collect(),
            direct_scopes: user.scopes,
            effective_scopes: effective,
        })
    }

    async fn load(&self, ctx: &AuthContext, id: RoleId) -> Result<Role, RoleError> {
        self.roles.get(ctx.tenant_id, id).await?.ok_or(RoleError::NotFound)
    }

    async fn ensure_member(&self, ctx: &AuthContext, user_id: UserId) -> Result<crate::user::User, RoleError> {
        self.users
            .get_by_id(ctx.tenant_id, user_id)
            .await?
            .ok_or(RoleError::UserNotFound)
    }
}
