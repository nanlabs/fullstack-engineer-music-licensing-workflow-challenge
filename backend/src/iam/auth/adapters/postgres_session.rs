use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::iam::auth::model::UserSession;
use crate::iam::auth::port::SessionRepository;
use crate::kernel::UserId;

pub struct PostgresSessionRepository {
    pool: PgPool,
}

impl PostgresSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl SessionRepository for PostgresSessionRepository {
    async fn save(&self, session: &UserSession) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at, created_at, last_activity)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(&session.id)
        .bind(session.user_id.as_str())
        .bind(&session.ip_address)
        .bind(&session.user_agent)
        .bind(session.expires_at)
        .bind(session.created_at)
        .bind(session.last_activity)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_by_id(&self, session_id: &str) -> Result<Option<UserSession>, AppError> {
        let row = sqlx::query(
            r#"
            SELECT id, user_id, ip_address, user_agent, expires_at, created_at, last_activity
            FROM user_sessions
            WHERE id = $1 AND expires_at > NOW()
            "#,
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(session_from_row).transpose()
    }

    async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<UserSession>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT id, user_id, ip_address, user_agent, expires_at, created_at, last_activity
            FROM user_sessions
            WHERE user_id = $1 AND expires_at > NOW()
            ORDER BY last_activity DESC
            "#,
        )
        .bind(user_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(session_from_row).collect()
    }

    async fn update_activity(&self, session_id: &str) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE user_sessions SET last_activity = NOW() WHERE id = $1 AND expires_at > NOW()",
        )
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn revoke(&self, session_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_sessions WHERE id = $1")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_sessions WHERE user_id = $1")
            .bind(user_id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn clean_expired(&self) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_sessions WHERE expires_at < NOW()")
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }
}

fn session_from_row(row: &sqlx::postgres::PgRow) -> Result<UserSession, AppError> {
    Ok(UserSession {
        id: row
            .try_get("id")
            .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        user_id: UserId::from_string(
            row.try_get("user_id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'user_id': {e}")))?,
        ),
        ip_address: row
            .try_get("ip_address")
            .map_err(|e| AppError::internal(format!("Failed to read column 'ip_address': {e}")))?,
        user_agent: row
            .try_get("user_agent")
            .map_err(|e| AppError::internal(format!("Failed to read column 'user_agent': {e}")))?,
        expires_at: row
            .try_get("expires_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'expires_at': {e}")))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        last_activity: row.try_get("last_activity").map_err(|e| {
            AppError::internal(format!("Failed to read column 'last_activity': {e}"))
        })?,
    })
}
