//! Roles bundle scopes. A member's effective scopes are the union of direct
//! grants and the scopes of every assigned role, resolved at token issuance.

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
use kernel::{RoleId, TenantId, UserId};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Clone)]
pub struct Role {
    pub id: RoleId,
    pub tenant_id: TenantId,
    pub name: String,
    pub description: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoleResponse {
    pub id: RoleId,
    pub tenant_id: TenantId,
    pub name: String,
    pub description: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Role> for RoleResponse {
    fn from(r: &Role) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            name: r.name.clone(),
            description: r.description.clone(),
            scopes: r.scopes.clone(),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRoleRequest {
    #[validate(length(min = 2, max = 64))]
    pub name: String,
    #[serde(default)]
    #[validate(length(max = 256))]
    pub description: String,
    #[serde(default)]
    #[validate(length(max = 100))]
    pub scopes: Vec<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateRoleRequest {
    #[validate(length(min = 2, max = 64))]
    pub name: Option<String>,
    #[validate(length(max = 256))]
    pub description: Option<String>,
    #[validate(length(max = 100))]
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AssignRoleRequest {
    pub user_id: UserId,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserRolesResponse {
    pub user_id: UserId,
    pub roles: Vec<RoleResponse>,
    pub direct_scopes: Vec<String>,
    pub effective_scopes: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum RoleError {
    #[error("Role not found")]
    NotFound,
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<RoleError> for AppError {
    fn from(err: RoleError) -> Self {
        match err {
            RoleError::NotFound => AppError::not_found("ROLE_NOT_FOUND", err.to_string()),
            RoleError::UserNotFound => AppError::not_found("USER_NOT_FOUND", err.to_string()),
            RoleError::App(inner) => inner,
        }
    }
}
