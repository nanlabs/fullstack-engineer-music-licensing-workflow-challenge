//! Verified onboarding: consuming the signup OTP and accepting the invitation
//! happen in one PostgreSQL transaction, so a failure leaves neither a burnt
//! code nor a half-created member.
//!
//! This adapter deliberately mixes workflow checks and persistence (the same
//! documented exception Manifesto keeps in `authinfra`). Domain rules are
//! still expressed through the entities' methods.

use async_trait::async_trait;
use chrono::Utc;
use errx::AppError;
use kernel::TenantId;
use sqlx::PgPool;
use subtle::ConstantTimeEq;

use crate::auth::AuthError;
use crate::invitation::infra::postgres::{InvitationRow, INVITATION_COLUMNS};
use crate::invitation::{hash_token, Invitation, InvitationError};
use crate::otp::infra::postgres::{OtpRow, OTP_COLUMNS};
use crate::otp::{hash_code, normalize_contact, Otp, OtpError, OtpPurpose};
use crate::tenant::infra::postgres::{TenantRow, TENANT_COLUMNS};
use crate::tenant::{Tenant, TenantError};
use crate::user::infra::postgres::{UserRow, USER_COLUMNS};
use crate::user::{User, UserError, UserStatus};

#[derive(Debug, Clone)]
pub struct Candidate {
    pub email: String,
    pub name: String,
    pub tenant_id: TenantId,
}

#[async_trait]
pub trait InvitationAcceptor: Send + Sync {
    /// Verifies the signup `code`, accepts the invitation identified by
    /// `raw_token` and commits membership, scopes and role in one transaction.
    async fn accept(&self, raw_token: &str, candidate: Candidate, code: &str) -> Result<(User, Tenant), AuthError>;
}

pub struct PostgresOnboarding {
    pool: PgPool,
}

impl PostgresOnboarding {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvitationAcceptor for PostgresOnboarding {
    async fn accept(&self, raw_token: &str, candidate: Candidate, code: &str) -> Result<(User, Tenant), AuthError> {
        let email = normalize_contact(&candidate.email);
        let now = Utc::now();
        let mut tx = self.pool.begin().await.map_err(AppError::from)?;

        // 1. Signup OTP, locked for the duration of the transaction.
        let otp: Otp = sqlx::query_as::<_, OtpRow>(&format!(
            "SELECT {OTP_COLUMNS} FROM otps WHERE contact = $1::citext AND purpose = $2 \
             ORDER BY created_at DESC LIMIT 1 FOR UPDATE"
        ))
        .bind(&email)
        .bind(OtpPurpose::Signup)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .map(Into::into)
        .ok_or(OtpError::Invalid { attempts_remaining: 0 })?;

        if otp.is_expired(now) {
            return Err(OtpError::Expired.into());
        }
        if otp.is_verified() {
            return Err(OtpError::AlreadyUsed.into());
        }
        if otp.attempts_remaining() == 0 {
            return Err(OtpError::TooManyAttempts.into());
        }
        let candidate_hash = hash_code(&email, OtpPurpose::Signup, code);
        let matches = bool::from(candidate_hash.as_slice().ct_eq(otp.code_hash.as_slice()));
        let updated: Otp = sqlx::query_as::<_, OtpRow>(&format!(
            "UPDATE otps SET attempts = attempts + 1, verified_at = CASE WHEN $2 THEN now() ELSE verified_at END \
             WHERE id = $1 RETURNING {OTP_COLUMNS}"
        ))
        .bind(otp.id)
        .bind(matches)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::from)?
        .into();
        if !matches {
            // Persist the failed attempt even though onboarding is aborted.
            tx.commit().await.map_err(AppError::from)?;
            return Err(OtpError::Invalid {
                attempts_remaining: updated.attempts_remaining(),
            }
            .into());
        }

        // 2. Invitation, locked.
        let invitation: Invitation = sqlx::query_as::<_, InvitationRow>(&format!(
            "SELECT {INVITATION_COLUMNS} FROM invitations WHERE token_hash = $1 FOR UPDATE"
        ))
        .bind(hash_token(raw_token))
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .map(Into::into)
        .ok_or(InvitationError::Invalid)?;
        if !invitation.can_be_accepted(now)
            || !invitation.matches_email(&email)
            || invitation.tenant_id != candidate.tenant_id
        {
            return Err(InvitationError::Invalid.into());
        }

        // 3. Tenant must be active.
        let tenant: Tenant =
            sqlx::query_as::<_, TenantRow>(&format!("SELECT {TENANT_COLUMNS} FROM tenants WHERE id = $1"))
                .bind(invitation.tenant_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(AppError::from)?
                .map(Into::into)
                .ok_or(TenantError::NotFound)?;
        if !tenant.is_active() {
            return Err(TenantError::Suspended.into());
        }

        // 4. Create the member or activate an existing pending/active one.
        let existing: Option<User> = sqlx::query_as::<_, UserRow>(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE tenant_id = $1 AND email = $2::citext FOR UPDATE"
        ))
        .bind(tenant.id)
        .bind(&email)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .map(Into::into);

        let name = candidate.name.trim().to_string();
        let user: User = match existing {
            Some(u) if u.status == UserStatus::Suspended => {
                return Err(UserError::InvalidStatus {
                    current: "suspended".into(),
                }
                .into());
            }
            Some(u) => sqlx::query_as::<_, UserRow>(&format!(
                "UPDATE users SET status = 'active', name = COALESCE(NULLIF($3, ''), name), \
                    email_verified = true, otp_enabled = true, \
                    scopes = ARRAY(SELECT DISTINCT s FROM unnest(scopes || $4::text[]) AS s ORDER BY s), \
                    updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2 RETURNING {USER_COLUMNS}"
            ))
            .bind(u.id)
            .bind(tenant.id)
            .bind(&name)
            .bind(&invitation.scopes)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::from)?
            .into(),
            None => sqlx::query_as::<_, UserRow>(&format!(
                "INSERT INTO users (id, tenant_id, email, name, status, scopes, email_verified, otp_enabled) \
                 VALUES ($1, $2, $3::citext, $4, 'active', $5, true, true) RETURNING {USER_COLUMNS}"
            ))
            .bind(kernel::UserId::generate())
            .bind(tenant.id)
            .bind(&email)
            .bind(&name)
            .bind(&invitation.scopes)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::from)?
            .into(),
        };

        // 5. Role assignment, constrained to the tenant.
        if let Some(role_id) = invitation.role_id {
            sqlx::query(
                "INSERT INTO user_roles (user_id, role_id) \
                 SELECT $1, r.id FROM roles r WHERE r.id = $2 AND r.tenant_id = $3 ON CONFLICT DO NOTHING",
            )
            .bind(user.id)
            .bind(role_id)
            .bind(tenant.id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;
        }

        // 6. Invitation consumed.
        sqlx::query(
            "UPDATE invitations SET status = 'accepted', accepted_at = now(), accepted_user_id = $2, updated_at = now() \
             WHERE id = $1",
        )
        .bind(invitation.id)
        .bind(user.id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

        tx.commit().await.map_err(AppError::from)?;
        tracing::info!(user_id = %user.id, tenant_id = %tenant.id, invitation_id = %invitation.id, "invitation accepted");
        Ok((user, tenant))
    }
}
