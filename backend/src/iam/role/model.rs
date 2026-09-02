use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::kernel::{RoleId, UserId};

// ============================================================================
// Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: RoleId,
    pub name: String,
    pub description: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Role {
    pub fn new(name: String, description: String, scopes: Vec<String>) -> Self {
        let now = Utc::now();
        Self {
            id: RoleId::new(),
            name,
            description,
            scopes,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn has_scope(&self, scope: &str) -> bool {
        crate::iam::scopes::scopes_contain(&self.scopes, scope)
    }

    pub fn set_scopes(&mut self, scopes: Vec<String>) {
        self.scopes = scopes;
        self.updated_at = Utc::now();
    }
}

// ============================================================================
// User-Role Assignment
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRole {
    pub user_id: UserId,
    pub role_id: RoleId,
    pub assigned_at: DateTime<Utc>,
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct RoleResponse {
    pub id: RoleId,
    pub name: String,
    pub description: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Role> for RoleResponse {
    fn from(r: &Role) -> Self {
        Self {
            id: r.id.clone(),
            name: r.name.clone(),
            description: r.description.clone(),
            scopes: r.scopes.clone(),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub description: Option<String>,
    pub scopes: Vec<String>,
}

impl CreateRoleRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().len() < 2 {
            return Err(
                AppError::validation("Name is required and must be at least 2 characters")
                    .with_detail("field", "name"),
            );
        }
        if self.scopes.is_empty() {
            return Err(AppError::validation("At least one scope is required")
                .with_detail("field", "scopes"));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub scopes: Option<Vec<String>>,
}

impl UpdateRoleRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(name) = &self.name
            && name.trim().len() < 2
        {
            return Err(AppError::validation("Name must be at least 2 characters")
                .with_detail("field", "name"));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct AssignRoleRequest {
    pub user_id: UserId,
}

impl AssignRoleRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.user_id.as_str().is_empty() {
            return Err(AppError::validation("User ID is required").with_detail("field", "user_id"));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct UserRolesResponse {
    pub user_id: UserId,
    pub roles: Vec<RoleResponse>,
    pub effective_scopes: Vec<String>,
}
