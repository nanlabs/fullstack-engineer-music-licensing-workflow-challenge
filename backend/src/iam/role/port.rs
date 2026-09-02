use crate::error::AppError;
use crate::kernel::{RoleId, UserId};

use super::Role;

#[async_trait::async_trait]
pub trait RoleRepository: Send + Sync {
    async fn save(&self, role: &Role) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &RoleId) -> Result<Option<Role>, AppError>;
    async fn get_by_name(&self, name: &str) -> Result<Option<Role>, AppError>;
    async fn list_all(&self) -> Result<Vec<Role>, AppError>;
    async fn delete(&self, id: &RoleId) -> Result<(), AppError>;

    // User-role assignments
    async fn assign_to_user(&self, user_id: &UserId, role_id: &RoleId) -> Result<(), AppError>;
    async fn unassign_from_user(&self, user_id: &UserId, role_id: &RoleId) -> Result<(), AppError>;
    async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Role>, AppError>;
}
