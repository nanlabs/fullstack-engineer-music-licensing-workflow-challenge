use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::TenantId;
use sqlx::PgPool;

use crate::tenant::port::TenantRepository;
use crate::tenant::{Tenant, TenantStatus};

pub const TENANT_COLUMNS: &str = "id, slug, name, status, created_at, updated_at";

#[derive(sqlx::FromRow)]
pub struct TenantRow {
    id: TenantId,
    slug: String,
    name: String,
    status: TenantStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TenantRow> for Tenant {
    fn from(r: TenantRow) -> Self {
        Tenant {
            id: r.id,
            slug: r.slug,
            name: r.name,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresTenantRepository {
    pool: PgPool,
}

impl PostgresTenantRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TenantRepository for PostgresTenantRepository {
    async fn get_by_id(&self, id: TenantId) -> AppResult<Option<Tenant>> {
        let row = sqlx::query_as::<_, TenantRow>(&format!("SELECT {TENANT_COLUMNS} FROM tenants WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(Into::into))
    }

    async fn get_by_slug(&self, slug: &str) -> AppResult<Option<Tenant>> {
        let row = sqlx::query_as::<_, TenantRow>(&format!("SELECT {TENANT_COLUMNS} FROM tenants WHERE slug = $1"))
            .bind(slug)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(Into::into))
    }
}
