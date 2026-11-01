//! Tenant entity. Customer IAM only ever exposes the caller's own tenant;
//! cross-tenant administration belongs to a separate operator application.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::TenantId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TenantStatus {
    Active,
    Suspended,
}

#[derive(Debug, Clone)]
pub struct Tenant {
    pub id: TenantId,
    pub slug: String,
    pub name: String,
    pub status: TenantStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Tenant {
    pub fn is_active(&self) -> bool {
        self.status == TenantStatus::Active
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TenantResponse {
    pub id: TenantId,
    pub slug: String,
    pub name: String,
    pub status: TenantStatus,
    pub created_at: DateTime<Utc>,
}

impl From<&Tenant> for TenantResponse {
    fn from(t: &Tenant) -> Self {
        Self {
            id: t.id,
            slug: t.slug.clone(),
            name: t.name.clone(),
            status: t.status,
            created_at: t.created_at,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TenantError {
    #[error("Tenant not found")]
    NotFound,
    #[error("Tenant is suspended")]
    Suspended,
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<TenantError> for AppError {
    fn from(err: TenantError) -> Self {
        match err {
            TenantError::NotFound => AppError::not_found("TENANT_NOT_FOUND", err.to_string()),
            TenantError::Suspended => AppError::forbidden(err.to_string()),
            TenantError::App(inner) => inner,
        }
    }
}
