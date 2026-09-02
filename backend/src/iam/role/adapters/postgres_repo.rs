use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::iam::role::{Role, RoleRepository};
use crate::kernel::{RoleId, UserId};

pub struct PostgresRoleRepository {
    pool: PgPool,
}

impl PostgresRoleRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl RoleRepository for PostgresRoleRepository {
    async fn save(&self, role: &Role) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO roles (id, name, description, scopes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE
            SET name = $2, description = $3, scopes = $4, updated_at = $6
            "#,
        )
        .bind(role.id.as_str())
        .bind(&role.name)
        .bind(&role.description)
        .bind(&role.scopes)
        .bind(role.created_at)
        .bind(role.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_by_id(&self, id: &RoleId) -> Result<Option<Role>, AppError> {
        let row = sqlx::query(
            "SELECT id, name, description, scopes, created_at, updated_at FROM roles WHERE id = $1",
        )
        .bind(id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(role_from_row).transpose()
    }

    async fn get_by_name(&self, name: &str) -> Result<Option<Role>, AppError> {
        let row = sqlx::query(
            "SELECT id, name, description, scopes, created_at, updated_at FROM roles WHERE name = $1",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(role_from_row).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Role>, AppError> {
        let rows = sqlx::query(
            "SELECT id, name, description, scopes, created_at, updated_at FROM roles ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(role_from_row).collect()
    }

    async fn delete(&self, id: &RoleId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM roles WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn assign_to_user(&self, user_id: &UserId, role_id: &RoleId) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO user_roles (user_id, role_id, assigned_at)
            VALUES ($1, $2, now())
            ON CONFLICT (user_id, role_id) DO NOTHING
            "#,
        )
        .bind(user_id.as_str())
        .bind(role_id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn unassign_from_user(&self, user_id: &UserId, role_id: &RoleId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2")
            .bind(user_id.as_str())
            .bind(role_id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Role>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT r.id, r.name, r.description, r.scopes, r.created_at, r.updated_at
            FROM roles r
            INNER JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = $1
            ORDER BY r.name
            "#,
        )
        .bind(user_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(role_from_row).collect()
    }
}

// ============================================================================
// Row Mapping
// ============================================================================

fn role_from_row(row: &sqlx::postgres::PgRow) -> Result<Role, AppError> {
    Ok(Role {
        id: RoleId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        ),
        name: row
            .try_get("name")
            .map_err(|e| AppError::internal(format!("Failed to read column 'name': {e}")))?,
        description: row
            .try_get("description")
            .map_err(|e| AppError::internal(format!("Failed to read column 'description': {e}")))?,
        scopes: row
            .try_get("scopes")
            .map_err(|e| AppError::internal(format!("Failed to read column 'scopes': {e}")))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'updated_at': {e}")))?,
    })
}
