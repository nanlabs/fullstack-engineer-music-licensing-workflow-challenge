use std::sync::Arc;

use chrono::{Duration as ChronoDuration, Utc};
use kernel::{AuthContext, InvitationId, PageQuery, Paginated, TenantId};
use validator::Validate;

use super::port::{InvitationNotifier, InvitationRepository};
use super::{
    generate_token, hash_token, CreateInvitationRequest, CreateInvitationResponse, Invitation, InvitationError,
    InvitationResponse, InvitationStatus,
};
use crate::config::InvitationConfig;
use crate::role::port::RoleRepository;
use crate::tenant::port::TenantRepository;
use crate::tenant::TenantError;
use crate::user::normalize_scopes;
use crate::user::port::UserRepository;
use crate::user::UserStatus;
use crate::{authz, scopes};

pub struct InvitationService {
    invitations: Arc<dyn InvitationRepository>,
    users: Arc<dyn UserRepository>,
    roles: Arc<dyn RoleRepository>,
    tenants: Arc<dyn TenantRepository>,
    notifier: Arc<dyn InvitationNotifier>,
    config: InvitationConfig,
}

impl InvitationService {
    pub fn new(
        invitations: Arc<dyn InvitationRepository>,
        users: Arc<dyn UserRepository>,
        roles: Arc<dyn RoleRepository>,
        tenants: Arc<dyn TenantRepository>,
        notifier: Arc<dyn InvitationNotifier>,
        config: InvitationConfig,
    ) -> Self {
        Self {
            invitations,
            users,
            roles,
            tenants,
            notifier,
            config,
        }
    }

    pub async fn create(
        &self,
        ctx: &AuthContext,
        req: CreateInvitationRequest,
    ) -> Result<CreateInvitationResponse, InvitationError> {
        req.validate().map_err(errx::AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::INVITATIONS_WRITE)?;
        let inviter = authz::require_user(ctx)?;
        let email = req.email.trim().to_ascii_lowercase();

        let granted = normalize_scopes(&req.scopes);
        scopes::validate_grantable(&granted)?;
        scopes::ensure_can_grant(ctx, &granted)?;
        if let Some(role_id) = req.role_id {
            let role = self
                .roles
                .get(ctx.tenant_id, role_id)
                .await?
                .ok_or(InvitationError::RoleNotFound)?;
            scopes::ensure_can_grant(ctx, &role.scopes)?;
        }

        if let Some(member) = self.users.get_by_email(ctx.tenant_id, &email).await? {
            if member.status == UserStatus::Suspended {
                return Err(InvitationError::MemberNotEligible);
            }
        }

        self.invitations.expire_stale(ctx.tenant_id, &email).await?;

        let (raw_token, token_hash) = generate_token()?;
        let now = Utc::now();
        let ttl = ChronoDuration::from_std(self.config.ttl).unwrap_or_else(|_| ChronoDuration::days(7));
        let invitation = Invitation {
            id: InvitationId::generate(),
            tenant_id: ctx.tenant_id,
            email,
            token_hash,
            scopes: granted,
            role_id: req.role_id,
            invited_by: inviter,
            status: InvitationStatus::Pending,
            expires_at: now + ttl,
            accepted_at: None,
            accepted_user_id: None,
            created_at: now,
            updated_at: now,
        };
        self.invitations.insert(&invitation).await?;

        let delivered = self.deliver(&invitation, &raw_token).await;
        Ok(CreateInvitationResponse {
            invitation: InvitationResponse::from(&invitation),
            delivered,
        })
    }

    pub async fn list(
        &self,
        ctx: &AuthContext,
        page: PageQuery,
    ) -> Result<Paginated<InvitationResponse>, InvitationError> {
        authz::require(ctx, ctx.tenant_id, scopes::INVITATIONS_READ)?;
        let page = page.normalized();
        let (items, total) = self.invitations.list(ctx.tenant_id, page).await?;
        Ok(Paginated::new(
            items.iter().map(InvitationResponse::from).collect(),
            page,
            total,
        ))
    }

    pub async fn get(&self, ctx: &AuthContext, id: InvitationId) -> Result<InvitationResponse, InvitationError> {
        authz::require(ctx, ctx.tenant_id, scopes::INVITATIONS_READ)?;
        let invitation = self.load(ctx, id).await?;
        Ok(InvitationResponse::from(&invitation))
    }

    /// Issues a fresh token (only the hash is stored, so the old one cannot be
    /// re-sent) and extends the expiry.
    pub async fn resend(
        &self,
        ctx: &AuthContext,
        id: InvitationId,
    ) -> Result<CreateInvitationResponse, InvitationError> {
        authz::require(ctx, ctx.tenant_id, scopes::INVITATIONS_WRITE)?;
        let invitation = self.load(ctx, id).await?;
        if invitation.status != InvitationStatus::Pending {
            return Err(InvitationError::NotPending);
        }
        let (raw_token, token_hash) = generate_token()?;
        let ttl = ChronoDuration::from_std(self.config.ttl).unwrap_or_else(|_| ChronoDuration::days(7));
        let invitation = self
            .invitations
            .rotate_token(ctx.tenant_id, id, &token_hash, Utc::now() + ttl)
            .await?
            .ok_or(InvitationError::NotPending)?;
        let delivered = self.deliver(&invitation, &raw_token).await;
        Ok(CreateInvitationResponse {
            invitation: InvitationResponse::from(&invitation),
            delivered,
        })
    }

    pub async fn revoke(&self, ctx: &AuthContext, id: InvitationId) -> Result<InvitationResponse, InvitationError> {
        authz::require(ctx, ctx.tenant_id, scopes::INVITATIONS_WRITE)?;
        let invitation = self.load(ctx, id).await?;
        if invitation.status != InvitationStatus::Pending {
            return Err(InvitationError::NotPending);
        }
        let invitation = self
            .invitations
            .set_status(ctx.tenant_id, id, InvitationStatus::Revoked)
            .await?
            .ok_or(InvitationError::NotFound)?;
        Ok(InvitationResponse::from(&invitation))
    }

    /// Trusted check used by the signup flow before sending or verifying an OTP.
    /// Does not change anything; acceptance re-checks inside its transaction.
    pub async fn validate_for_signup(
        &self,
        raw_token: &str,
        email: &str,
        tenant_id: Option<TenantId>,
    ) -> Result<Invitation, InvitationError> {
        let invitation = self
            .invitations
            .get_by_token_hash(&hash_token(raw_token))
            .await?
            .ok_or(InvitationError::Invalid)?;
        let now = Utc::now();
        if !invitation.can_be_accepted(now)
            || !invitation.matches_email(email)
            || tenant_id.is_some_and(|t| t != invitation.tenant_id)
        {
            return Err(InvitationError::Invalid);
        }
        let tenant = self
            .tenants
            .get_by_id(invitation.tenant_id)
            .await?
            .ok_or(InvitationError::Invalid)?;
        if !tenant.is_active() {
            return Err(InvitationError::App(TenantError::Suspended.into()));
        }
        if let Some(member) = self.users.get_by_email(invitation.tenant_id, &invitation.email).await? {
            if member.status == UserStatus::Suspended {
                return Err(InvitationError::MemberNotEligible);
            }
        }
        Ok(invitation)
    }

    async fn load(&self, ctx: &AuthContext, id: InvitationId) -> Result<Invitation, InvitationError> {
        self.invitations
            .get(ctx.tenant_id, id)
            .await?
            .ok_or(InvitationError::NotFound)
    }

    async fn deliver(&self, invitation: &Invitation, raw_token: &str) -> bool {
        match self
            .notifier
            .send_invitation(
                &invitation.email,
                raw_token,
                invitation.tenant_id,
                invitation.invited_by,
            )
            .await
        {
            Ok(()) => true,
            Err(err) => {
                tracing::error!(invitation_id = %invitation.id, error = %err, "invitation delivery failed; it stays pending and can be resent");
                false
            }
        }
    }
}
