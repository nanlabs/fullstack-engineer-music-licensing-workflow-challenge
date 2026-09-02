use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::iam::user::model::{OAuthProvider, UserFilter, UserStatus};
use crate::iam::user::{User, UserRepository};
use crate::kernel::{Paginated, PaginationOptions, UserId};

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

const USER_COLUMNS: &str = "id, email, name, password_hash, picture, oauth_provider, oauth_provider_id, status, email_verified, last_login_at, created_at, updated_at";

#[async_trait::async_trait]
impl UserRepository for PostgresUserRepository {
    async fn get_by_id(&self, id: &UserId) -> Result<Option<User>, AppError> {
        let row = sqlx::query(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1"))
            .bind(id.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(user_from_row).transpose()
    }

    async fn get_by_ids(&self, ids: &[UserId]) -> Result<Vec<User>, AppError> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let id_strs: Vec<&str> = ids.iter().map(UserId::as_str).collect();
        let rows = sqlx::query(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE id = ANY($1)"
        ))
        .bind(&id_strs)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(user_from_row).collect()
    }

    async fn get_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let row = sqlx::query(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE email = $1"
        ))
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(user_from_row).transpose()
    }

    async fn find(
        &self,
        opts: &PaginationOptions,
        filter: &UserFilter,
    ) -> Result<Paginated<User>, AppError> {
        let search_pattern = filter.search.as_ref().map(|s| format!("%{s}%"));
        let status = filter
            .status
            .as_ref()
            .map(|s| format!("{s:?}").to_uppercase());

        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM users
            WHERE ($1::text IS NULL OR (name ILIKE $1 OR email ILIKE $1))
              AND ($2::text IS NULL OR status = $2)
            "#,
        )
        .bind(&search_pattern)
        .bind(&status)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        let rows = sqlx::query(&format!(
            r#"
                SELECT {USER_COLUMNS}
                FROM users
                WHERE ($1::text IS NULL OR (name ILIKE $1 OR email ILIKE $1))
                  AND ($2::text IS NULL OR status = $2)
                ORDER BY created_at DESC
                LIMIT $3 OFFSET $4
                "#
        ))
        .bind(&search_pattern)
        .bind(&status)
        .bind(opts.limit())
        .bind(opts.offset())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        let users: Result<Vec<User>, AppError> = rows.iter().map(user_from_row).collect();
        Ok(Paginated::new(users?, opts.page, opts.page_size, total))
    }

    async fn save(&self, user: &User) -> Result<(), AppError> {
        let status = format!("{:?}", user.status).to_uppercase();
        let oauth_provider = user
            .oauth_provider
            .as_ref()
            .map(|p| format!("{p:?}").to_uppercase());
        sqlx::query(
            r#"
            INSERT INTO users (id, email, name, password_hash, picture, oauth_provider, oauth_provider_id, status, email_verified, last_login_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#,
        )
        .bind(user.id.as_str())
        .bind(&user.email)
        .bind(&user.name)
        .bind(&user.password_hash)
        .bind(&user.picture)
        .bind(&oauth_provider)
        .bind(&user.oauth_provider_id)
        .bind(&status)
        .bind(user.email_verified)
        .bind(user.last_login_at)
        .bind(user.created_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn update(&self, user: &User) -> Result<(), AppError> {
        let status = format!("{:?}", user.status).to_uppercase();
        let oauth_provider = user
            .oauth_provider
            .as_ref()
            .map(|p| format!("{p:?}").to_uppercase());
        sqlx::query(
            r#"
            UPDATE users
            SET email = $2, name = $3, password_hash = $4, picture = $5,
                oauth_provider = $6, oauth_provider_id = $7, status = $8,
                email_verified = $9, last_login_at = $10, updated_at = $11
            WHERE id = $1
            "#,
        )
        .bind(user.id.as_str())
        .bind(&user.email)
        .bind(&user.name)
        .bind(&user.password_hash)
        .bind(&user.picture)
        .bind(&oauth_provider)
        .bind(&user.oauth_provider_id)
        .bind(&status)
        .bind(user.email_verified)
        .bind(user.last_login_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn delete(&self, id: &UserId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }
}

// ============================================================================
// Row Mapping
// ============================================================================

fn user_from_row(row: &sqlx::postgres::PgRow) -> Result<User, AppError> {
    let status_str: String = row
        .try_get("status")
        .map_err(|e| AppError::internal(format!("Failed to read column 'status': {e}")))?;
    let status = UserStatus::try_from(status_str.as_str())?;

    let oauth_provider: Option<OAuthProvider> = row
        .try_get::<Option<String>, _>("oauth_provider")
        .map_err(|e| AppError::internal(format!("Failed to read column 'oauth_provider': {e}")))?
        .map(|s| OAuthProvider::try_from(s.as_str()))
        .transpose()?;

    Ok(User {
        id: UserId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        ),
        email: row
            .try_get("email")
            .map_err(|e| AppError::internal(format!("Failed to read column 'email': {e}")))?,
        name: row
            .try_get("name")
            .map_err(|e| AppError::internal(format!("Failed to read column 'name': {e}")))?,
        picture: row
            .try_get("picture")
            .map_err(|e| AppError::internal(format!("Failed to read column 'picture': {e}")))?,
        password_hash: row.try_get("password_hash").map_err(|e| {
            AppError::internal(format!("Failed to read column 'password_hash': {e}"))
        })?,
        oauth_provider,
        oauth_provider_id: row.try_get("oauth_provider_id").map_err(|e| {
            AppError::internal(format!("Failed to read column 'oauth_provider_id': {e}"))
        })?,
        status,
        email_verified: row.try_get("email_verified").map_err(|e| {
            AppError::internal(format!("Failed to read column 'email_verified': {e}"))
        })?,
        last_login_at: row.try_get("last_login_at").map_err(|e| {
            AppError::internal(format!("Failed to read column 'last_login_at': {e}"))
        })?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'updated_at': {e}")))?,
    })
}
