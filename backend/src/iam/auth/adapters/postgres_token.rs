use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::iam::auth::model::RefreshToken;
use crate::iam::auth::port::TokenRepository;
use crate::kernel::UserId;

pub struct PostgresTokenRepository {
    pool: PgPool,
}

impl PostgresTokenRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl TokenRepository for PostgresTokenRepository {
    async fn save_refresh_token(&self, token: &RefreshToken) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO refresh_tokens (id, token, user_id, session_id, expires_at, created_at, is_revoked)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(&token.id)
        .bind(&token.token)
        .bind(token.user_id.as_str())
        .bind(&token.session_id)
        .bind(token.expires_at)
        .bind(token.created_at)
        .bind(token.is_revoked)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_refresh_token(&self, token: &str) -> Result<Option<RefreshToken>, AppError> {
        let row = sqlx::query(
            "SELECT id, token, user_id, session_id, expires_at, created_at, is_revoked FROM refresh_tokens WHERE token = $1",
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(refresh_token_from_row).transpose()
    }

    async fn revoke_refresh_token(&self, token: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE refresh_tokens SET is_revoked = true WHERE token = $1")
            .bind(token)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false",
        )
        .bind(user_id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn revoke_by_session(&self, session_id: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE refresh_tokens SET is_revoked = true WHERE session_id = $1 AND is_revoked = false")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }
}

fn refresh_token_from_row(row: &sqlx::postgres::PgRow) -> Result<RefreshToken, AppError> {
    Ok(RefreshToken {
        id: row
            .try_get("id")
            .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        token: row
            .try_get("token")
            .map_err(|e| AppError::internal(format!("Failed to read column 'token': {e}")))?,
        user_id: UserId::from_string(
            row.try_get("user_id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'user_id': {e}")))?,
        ),
        session_id: row
            .try_get("session_id")
            .map_err(|e| AppError::internal(format!("Failed to read column 'session_id': {e}")))?,
        expires_at: row
            .try_get("expires_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'expires_at': {e}")))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        is_revoked: row
            .try_get("is_revoked")
            .map_err(|e| AppError::internal(format!("Failed to read column 'is_revoked': {e}")))?,
    })
}
