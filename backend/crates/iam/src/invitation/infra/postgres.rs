use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{InvitationId, PageQuery, RoleId, TenantId, UserId};
use sqlx::PgPool;

use crate::invitation::port::InvitationRepository;
use crate::invitation::{Invitation, InvitationFilter, InvitationStatus};
use crate::role::infra::postgres::map_unique_violation;

pub const INVITATION_COLUMNS: &str =
    "id, tenant_id, email::text AS email, token_hash, scopes, role_id, invited_by, status, \
                                      expires_at, accepted_at, accepted_user_id, created_at, updated_at";

#[derive(sqlx::FromRow)]
pub struct InvitationRow {
    id: InvitationId,
    tenant_id: TenantId,
    email: String,
    token_hash: Vec<u8>,
    scopes: Vec<String>,
    role_id: Option<RoleId>,
    invited_by: UserId,
    status: InvitationStatus,
    expires_at: DateTime<Utc>,
    accepted_at: Option<DateTime<Utc>>,
    accepted_user_id: Option<UserId>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<InvitationRow> for Invitation {
    fn from(r: InvitationRow) -> Self {
        Invitation {
            id: r.id,
            tenant_id: r.tenant_id,
            email: r.email,
            token_hash: r.token_hash,
            scopes: r.scopes,
            role_id: r.role_id,
            invited_by: r.invited_by,
            status: r.status,
            expires_at: r.expires_at,
            accepted_at: r.accepted_at,
            accepted_user_id: r.accepted_user_id,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresInvitationRepository {
    pool: PgPool,
}

impl PostgresInvitationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvitationRepository for PostgresInvitationRepository {
    async fn insert(&self, i: &Invitation) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO invitations (id, tenant_id, email, token_hash, scopes, role_id, invited_by, status, \
                                      expires_at, created_at, updated_at) \
             VALUES ($1, $2, $3::citext, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(i.id)
        .bind(i.tenant_id)
        .bind(&i.email)
        .bind(&i.token_hash)
        .bind(&i.scopes)
        .bind(i.role_id)
        .bind(i.invited_by)
        .bind(i.status)
        .bind(i.expires_at)
        .bind(i.created_at)
        .bind(i.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            map_unique_violation(
                e,
                "INVITATION_ALREADY_PENDING",
                "A pending invitation already exists for this email",
            )
        })?;
        Ok(())
    }

    async fn get(&self, tenant_id: TenantId, id: InvitationId) -> AppResult<Option<Invitation>> {
        let row = sqlx::query_as::<_, InvitationRow>(&format!(
            "SELECT {INVITATION_COLUMNS} FROM invitations WHERE tenant_id = $1 AND id = $2"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn get_by_token_hash(&self, token_hash: &[u8]) -> AppResult<Option<Invitation>> {
        let row = sqlx::query_as::<_, InvitationRow>(&format!(
            "SELECT {INVITATION_COLUMNS} FROM invitations WHERE token_hash = $1"
        ))
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn list(
        &self,
        tenant_id: TenantId,
        filter: &InvitationFilter,
        page: PageQuery,
    ) -> AppResult<(Vec<Invitation>, u64)> {
        let status = filter.status.map(|s| s.as_str());
        let rows = sqlx::query_as::<_, InvitationRow>(&format!(
            "SELECT {INVITATION_COLUMNS} FROM invitations \
             WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) \
             ORDER BY created_at DESC, id LIMIT $3 OFFSET $4"
        ))
        .bind(tenant_id)
        .bind(status)
        .bind(page.limit())
        .bind(page.offset())
        .fetch_all(&self.pool)
        .await?;
        let total: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM invitations WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2)",
        )
        .bind(tenant_id)
        .bind(status)
        .fetch_one(&self.pool)
        .await?;
        Ok((rows.into_iter().map(Into::into).collect(), total.max(0) as u64))
    }

    async fn expire_stale(&self, tenant_id: TenantId, email: &str) -> AppResult<u64> {
        let result = sqlx::query(
            "UPDATE invitations SET status = 'expired', updated_at = now() \
             WHERE tenant_id = $1 AND email = $2::citext AND status = 'pending' AND expires_at <= now()",
        )
        .bind(tenant_id)
        .bind(email)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    async fn set_status(
        &self,
        tenant_id: TenantId,
        id: InvitationId,
        status: InvitationStatus,
    ) -> AppResult<Option<Invitation>> {
        let row = sqlx::query_as::<_, InvitationRow>(&format!(
            "UPDATE invitations SET status = $3, updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 RETURNING {INVITATION_COLUMNS}"
        ))
        .bind(tenant_id)
        .bind(id)
        .bind(status)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn rotate_token(
        &self,
        tenant_id: TenantId,
        id: InvitationId,
        token_hash: &[u8],
        expires_at: DateTime<Utc>,
    ) -> AppResult<Option<Invitation>> {
        let row = sqlx::query_as::<_, InvitationRow>(&format!(
            "UPDATE invitations SET token_hash = $3, expires_at = $4, updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 AND status = 'pending' RETURNING {INVITATION_COLUMNS}"
        ))
        .bind(tenant_id)
        .bind(id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }
}
