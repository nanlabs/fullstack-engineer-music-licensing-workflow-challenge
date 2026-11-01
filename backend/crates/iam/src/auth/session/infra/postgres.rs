use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{SessionId, TenantId, UserId};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::session::port::{RefreshTokenRepository, SessionRepository};
use crate::auth::session::{RefreshToken, Session};

const SESSION_COLUMNS: &str =
    "id, user_id, tenant_id, ip_address, user_agent, expires_at, revoked_at, created_at, last_activity_at";

#[derive(sqlx::FromRow)]
struct SessionRow {
    id: SessionId,
    user_id: UserId,
    tenant_id: TenantId,
    ip_address: String,
    user_agent: String,
    expires_at: DateTime<Utc>,
    revoked_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    last_activity_at: DateTime<Utc>,
}

impl From<SessionRow> for Session {
    fn from(r: SessionRow) -> Self {
        Session {
            id: r.id,
            user_id: r.user_id,
            tenant_id: r.tenant_id,
            ip_address: r.ip_address,
            user_agent: r.user_agent,
            expires_at: r.expires_at,
            revoked_at: r.revoked_at,
            created_at: r.created_at,
            last_activity_at: r.last_activity_at,
        }
    }
}

pub struct PostgresSessionRepository {
    pool: PgPool,
}

impl PostgresSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SessionRepository for PostgresSessionRepository {
    async fn insert(&self, s: &Session) -> AppResult<()> {
        sqlx::query(&format!(
            "INSERT INTO sessions ({SESSION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        ))
        .bind(s.id)
        .bind(s.user_id)
        .bind(s.tenant_id)
        .bind(&s.ip_address)
        .bind(&s.user_agent)
        .bind(s.expires_at)
        .bind(s.revoked_at)
        .bind(s.created_at)
        .bind(s.last_activity_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get(&self, id: SessionId) -> AppResult<Option<Session>> {
        let row = sqlx::query_as::<_, SessionRow>(&format!("SELECT {SESSION_COLUMNS} FROM sessions WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(Into::into))
    }

    async fn list_active_by_user(&self, user_id: UserId) -> AppResult<Vec<Session>> {
        let rows = sqlx::query_as::<_, SessionRow>(&format!(
            "SELECT {SESSION_COLUMNS} FROM sessions \
             WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC"
        ))
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn count_active(&self, user_id: UserId) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(count)
    }

    async fn oldest_active(&self, user_id: UserId) -> AppResult<Option<Session>> {
        let row = sqlx::query_as::<_, SessionRow>(&format!(
            "SELECT {SESSION_COLUMNS} FROM sessions \
             WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at ASC LIMIT 1"
        ))
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn touch(&self, id: SessionId) -> AppResult<()> {
        sqlx::query("UPDATE sessions SET last_activity_at = now() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn revoke(&self, id: SessionId) -> AppResult<bool> {
        let result = sqlx::query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn revoke_all_by_user(&self, user_id: UserId) -> AppResult<u64> {
        let result = sqlx::query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    async fn delete_expired(&self) -> AppResult<u64> {
        let result =
            sqlx::query("DELETE FROM sessions WHERE expires_at < now() OR revoked_at < now() - interval '30 days'")
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected())
    }
}

const TOKEN_COLUMNS: &str =
    "id, token_hash, user_id, tenant_id, session_id, credential_version, expires_at, revoked_at, created_at";

#[derive(sqlx::FromRow)]
struct RefreshTokenRow {
    id: Uuid,
    token_hash: Vec<u8>,
    user_id: UserId,
    tenant_id: TenantId,
    session_id: SessionId,
    credential_version: i64,
    expires_at: DateTime<Utc>,
    revoked_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

impl From<RefreshTokenRow> for RefreshToken {
    fn from(r: RefreshTokenRow) -> Self {
        RefreshToken {
            id: r.id,
            token_hash: r.token_hash,
            user_id: r.user_id,
            tenant_id: r.tenant_id,
            session_id: r.session_id,
            credential_version: r.credential_version,
            expires_at: r.expires_at,
            revoked_at: r.revoked_at,
            created_at: r.created_at,
        }
    }
}

pub struct PostgresRefreshTokenRepository {
    pool: PgPool,
}

impl PostgresRefreshTokenRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl RefreshTokenRepository for PostgresRefreshTokenRepository {
    async fn insert(&self, t: &RefreshToken) -> AppResult<()> {
        sqlx::query(&format!(
            "INSERT INTO refresh_tokens ({TOKEN_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        ))
        .bind(t.id)
        .bind(&t.token_hash)
        .bind(t.user_id)
        .bind(t.tenant_id)
        .bind(t.session_id)
        .bind(t.credential_version)
        .bind(t.expires_at)
        .bind(t.revoked_at)
        .bind(t.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get_by_hash(&self, token_hash: &[u8]) -> AppResult<Option<RefreshToken>> {
        let row = sqlx::query_as::<_, RefreshTokenRow>(&format!(
            "SELECT {TOKEN_COLUMNS} FROM refresh_tokens WHERE token_hash = $1"
        ))
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn revoke_by_hash(&self, token_hash: &[u8]) -> AppResult<bool> {
        let result =
            sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL")
                .bind(token_hash)
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn revoke_by_session(&self, session_id: SessionId) -> AppResult<u64> {
        let result =
            sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL")
                .bind(session_id)
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected())
    }

    async fn revoke_all_by_user(&self, user_id: UserId) -> AppResult<u64> {
        let result =
            sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
                .bind(user_id)
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected())
    }

    async fn delete_expired(&self) -> AppResult<u64> {
        let result = sqlx::query("DELETE FROM refresh_tokens WHERE expires_at < now()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
