use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{PageQuery, TenantId, UserId};
use sqlx::PgPool;

use crate::user::port::UserRepository;
use crate::user::{User, UserStatus};

pub const USER_COLUMNS: &str = "id, tenant_id, email::text AS email, name, status, scopes, credential_version, \
                                email_verified, otp_enabled, last_login_at, created_at, updated_at";

#[derive(sqlx::FromRow)]
pub struct UserRow {
    id: UserId,
    tenant_id: TenantId,
    email: String,
    name: String,
    status: UserStatus,
    scopes: Vec<String>,
    credential_version: i64,
    email_verified: bool,
    otp_enabled: bool,
    last_login_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<UserRow> for User {
    fn from(r: UserRow) -> Self {
        User {
            id: r.id,
            tenant_id: r.tenant_id,
            email: r.email,
            name: r.name,
            status: r.status,
            scopes: r.scopes,
            credential_version: r.credential_version,
            email_verified: r.email_verified,
            otp_enabled: r.otp_enabled,
            last_login_at: r.last_login_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn get_by_id(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE tenant_id = $1 AND id = $2"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn get_by_email(&self, tenant_id: TenantId, email: &str) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE tenant_id = $1 AND email = $2::citext"
        ))
        .bind(tenant_id)
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn find_by_email_across_tenants(&self, email: &str) -> AppResult<Vec<User>> {
        let rows = sqlx::query_as::<_, UserRow>(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE email = $1::citext ORDER BY created_at"
        ))
        .bind(email)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn list(&self, tenant_id: TenantId, page: PageQuery) -> AppResult<(Vec<User>, u64)> {
        let rows = sqlx::query_as::<_, UserRow>(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE tenant_id = $1 ORDER BY created_at, id LIMIT $2 OFFSET $3"
        ))
        .bind(tenant_id)
        .bind(page.limit())
        .bind(page.offset())
        .fetch_all(&self.pool)
        .await?;
        let total: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(&self.pool)
            .await?;
        Ok((rows.into_iter().map(Into::into).collect(), total.max(0) as u64))
    }

    async fn update_scopes(&self, tenant_id: TenantId, id: UserId, scopes: &[String]) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(&format!(
            "UPDATE users SET scopes = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 RETURNING {USER_COLUMNS}"
        ))
        .bind(tenant_id)
        .bind(id)
        .bind(scopes)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn suspend(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query_as::<_, UserRow>(&format!(
            "UPDATE users SET status = 'suspended', credential_version = credential_version + 1, updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 RETURNING {USER_COLUMNS}"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
        if row.is_some() {
            sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(row.map(Into::into))
    }

    async fn reinstate(&self, tenant_id: TenantId, id: UserId) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(&format!(
            "UPDATE users SET status = 'active', updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 AND status = 'suspended' RETURNING {USER_COLUMNS}"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn record_login(&self, id: UserId) -> AppResult<()> {
        sqlx::query("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
