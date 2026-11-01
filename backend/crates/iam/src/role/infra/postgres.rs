use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::{AppError, AppResult};
use kernel::{RoleId, TenantId, UserId};
use sqlx::PgPool;

use crate::role::port::RoleRepository;
use crate::role::Role;

const COLUMNS: &str = "id, tenant_id, name, description, scopes, created_at, updated_at";

#[derive(sqlx::FromRow)]
struct RoleRow {
    id: RoleId,
    tenant_id: TenantId,
    name: String,
    description: String,
    scopes: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<RoleRow> for Role {
    fn from(r: RoleRow) -> Self {
        Role {
            id: r.id,
            tenant_id: r.tenant_id,
            name: r.name,
            description: r.description,
            scopes: r.scopes,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresRoleRepository {
    pool: PgPool,
}

impl PostgresRoleRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Translates a unique-constraint violation into a domain conflict.
pub fn map_unique_violation(err: sqlx::Error, code: &'static str, message: &str) -> AppError {
    match &err {
        sqlx::Error::Database(db) if db.is_unique_violation() => AppError::conflict(code, message),
        _ => AppError::from(err),
    }
}

#[async_trait]
impl RoleRepository for PostgresRoleRepository {
    async fn get(&self, tenant_id: TenantId, id: RoleId) -> AppResult<Option<Role>> {
        let row =
            sqlx::query_as::<_, RoleRow>(&format!("SELECT {COLUMNS} FROM roles WHERE tenant_id = $1 AND id = $2"))
                .bind(tenant_id)
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(row.map(Into::into))
    }

    async fn list(&self, tenant_id: TenantId) -> AppResult<Vec<Role>> {
        let rows = sqlx::query_as::<_, RoleRow>(&format!(
            "SELECT {COLUMNS} FROM roles WHERE tenant_id = $1 ORDER BY name"
        ))
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn insert(&self, role: &Role) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO roles (id, tenant_id, name, description, scopes, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(role.id)
        .bind(role.tenant_id)
        .bind(&role.name)
        .bind(&role.description)
        .bind(&role.scopes)
        .bind(role.created_at)
        .bind(role.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| map_unique_violation(e, "ROLE_ALREADY_EXISTS", "A role with that name already exists"))?;
        Ok(())
    }

    async fn update(&self, role: &Role) -> AppResult<Option<Role>> {
        let row = sqlx::query_as::<_, RoleRow>(&format!(
            "UPDATE roles SET name = $3, description = $4, scopes = $5, updated_at = $6 \
             WHERE tenant_id = $1 AND id = $2 RETURNING {COLUMNS}"
        ))
        .bind(role.tenant_id)
        .bind(role.id)
        .bind(&role.name)
        .bind(&role.description)
        .bind(&role.scopes)
        .bind(role.updated_at)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| map_unique_violation(e, "ROLE_ALREADY_EXISTS", "A role with that name already exists"))?;
        Ok(row.map(Into::into))
    }

    async fn delete(&self, tenant_id: TenantId, id: RoleId) -> AppResult<bool> {
        let result = sqlx::query("DELETE FROM roles WHERE tenant_id = $1 AND id = $2")
            .bind(tenant_id)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn assign(&self, tenant_id: TenantId, role_id: RoleId, user_id: UserId) -> AppResult<()> {
        // The subquery guarantees both rows belong to the tenant.
        sqlx::query(
            "INSERT INTO user_roles (user_id, role_id) \
             SELECT u.id, r.id FROM users u JOIN roles r ON r.tenant_id = u.tenant_id \
             WHERE u.id = $1 AND r.id = $2 AND u.tenant_id = $3 \
             ON CONFLICT DO NOTHING",
        )
        .bind(user_id)
        .bind(role_id)
        .bind(tenant_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn unassign(&self, tenant_id: TenantId, role_id: RoleId, user_id: UserId) -> AppResult<bool> {
        let result = sqlx::query(
            "DELETE FROM user_roles ur USING roles r \
             WHERE ur.role_id = r.id AND r.tenant_id = $3 AND ur.user_id = $1 AND ur.role_id = $2",
        )
        .bind(user_id)
        .bind(role_id)
        .bind(tenant_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn roles_for_user(&self, tenant_id: TenantId, user_id: UserId) -> AppResult<Vec<Role>> {
        let rows = sqlx::query_as::<_, RoleRow>(
            "SELECT r.id, r.tenant_id, r.name, r.description, r.scopes, r.created_at, r.updated_at \
             FROM roles r JOIN user_roles ur ON ur.role_id = r.id \
             WHERE r.tenant_id = $1 AND ur.user_id = $2 ORDER BY r.name",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn effective_scopes(&self, tenant_id: TenantId, user_id: UserId) -> AppResult<Vec<String>> {
        let scopes: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT s FROM ( \
                SELECT unnest(u.scopes) AS s FROM users u WHERE u.id = $2 AND u.tenant_id = $1 \
                UNION \
                SELECT unnest(r.scopes) FROM roles r JOIN user_roles ur ON ur.role_id = r.id \
                WHERE ur.user_id = $2 AND r.tenant_id = $1 \
             ) x ORDER BY s",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(scopes)
    }
}
