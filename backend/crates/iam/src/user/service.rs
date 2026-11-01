use std::sync::Arc;

use kernel::{AuthContext, PageQuery, Paginated, UserId};
use validator::Validate;

use super::port::UserRepository;
use super::{normalize_scopes, SetScopesRequest, User, UserError, UserResponse, UserStatus};
use crate::{authz, scopes};

pub struct UserService {
    repo: Arc<dyn UserRepository>,
}

impl UserService {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn get(&self, ctx: &AuthContext, id: UserId) -> Result<UserResponse, UserError> {
        authz::require(ctx, ctx.tenant_id, scopes::USERS_READ)?;
        let user = self.load(ctx, id).await?;
        Ok(UserResponse::from(&user))
    }

    pub async fn list(&self, ctx: &AuthContext, page: PageQuery) -> Result<Paginated<UserResponse>, UserError> {
        authz::require(ctx, ctx.tenant_id, scopes::USERS_READ)?;
        let page = page.normalized();
        let (users, total) = self.repo.list(ctx.tenant_id, page).await?;
        let items = users.iter().map(UserResponse::from).collect();
        Ok(Paginated::new(items, page, total))
    }

    pub async fn suspend(&self, ctx: &AuthContext, id: UserId) -> Result<UserResponse, UserError> {
        authz::require(ctx, ctx.tenant_id, scopes::USERS_WRITE)?;
        if ctx.user_id() == Some(id) {
            return Err(UserError::CannotModifySelf);
        }
        let user = self.load(ctx, id).await?;
        if user.status == UserStatus::Suspended {
            return Err(UserError::InvalidStatus {
                current: "suspended".into(),
            });
        }
        let user = self.repo.suspend(ctx.tenant_id, id).await?.ok_or(UserError::NotFound)?;
        tracing::info!(user_id = %id, by = %ctx.actor.user_id().map(|u| u.to_string()).unwrap_or_default(), "user suspended");
        Ok(UserResponse::from(&user))
    }

    pub async fn reinstate(&self, ctx: &AuthContext, id: UserId) -> Result<UserResponse, UserError> {
        authz::require(ctx, ctx.tenant_id, scopes::USERS_WRITE)?;
        let user = self.load(ctx, id).await?;
        if user.status != UserStatus::Suspended {
            return Err(UserError::InvalidStatus {
                current: status_name(user.status).into(),
            });
        }
        let user = self
            .repo
            .reinstate(ctx.tenant_id, id)
            .await?
            .ok_or(UserError::NotFound)?;
        tracing::info!(user_id = %id, "user reinstated");
        Ok(UserResponse::from(&user))
    }

    pub async fn set_scopes(
        &self,
        ctx: &AuthContext,
        id: UserId,
        req: SetScopesRequest,
    ) -> Result<UserResponse, UserError> {
        req.validate().map_err(errx::AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::USERS_WRITE)?;
        authz::require(ctx, ctx.tenant_id, scopes::SCOPES_WRITE)?;
        let requested = normalize_scopes(&req.scopes);
        scopes::validate_grantable(&requested)?;
        scopes::ensure_can_grant(ctx, &requested)?;
        self.load(ctx, id).await?;
        let user = self
            .repo
            .update_scopes(ctx.tenant_id, id, &requested)
            .await?
            .ok_or(UserError::NotFound)?;
        Ok(UserResponse::from(&user))
    }

    async fn load(&self, ctx: &AuthContext, id: UserId) -> Result<User, UserError> {
        self.repo.get_by_id(ctx.tenant_id, id).await?.ok_or(UserError::NotFound)
    }
}

fn status_name(status: UserStatus) -> &'static str {
    match status {
        UserStatus::Pending => "pending",
        UserStatus::Active => "active",
        UserStatus::Suspended => "suspended",
    }
}
