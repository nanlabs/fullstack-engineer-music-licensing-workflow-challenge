use std::collections::{HashMap, HashSet};

use super::User;
use crate::error::AppError;
use crate::kernel::{Paginated, PaginationOptions, UserId};

use super::model::UserFilter;

#[async_trait::async_trait]
pub trait UserRepository: Send + Sync {
    async fn get_by_id(&self, id: &UserId) -> Result<Option<User>, AppError>;
    /// Batch lookup, used to resolve display names for a set of user ids
    /// (e.g. when building a list response) without one query per id.
    async fn get_by_ids(&self, ids: &[UserId]) -> Result<Vec<User>, AppError>;
    async fn get_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn find(
        &self,
        opts: &PaginationOptions,
        filter: &UserFilter,
    ) -> Result<Paginated<User>, AppError>;
    async fn save(&self, user: &User) -> Result<(), AppError>;
    async fn update(&self, user: &User) -> Result<(), AppError>;
    async fn delete(&self, id: &UserId) -> Result<(), AppError>;
}

/// Adds name-resolution helpers on top of any `UserRepository`, so other
/// modules' services can enrich response DTOs (e.g. `artist_name`,
/// `created_by_name`) without duplicating the dedup/batch-fetch logic.
#[async_trait::async_trait]
pub trait UserRepositoryExt {
    async fn resolve_names(
        &self,
        ids: impl IntoIterator<Item = UserId> + Send,
    ) -> Result<HashMap<UserId, String>, AppError>;
}

#[async_trait::async_trait]
impl UserRepositoryExt for dyn UserRepository + '_ {
    async fn resolve_names(
        &self,
        ids: impl IntoIterator<Item = UserId> + Send,
    ) -> Result<HashMap<UserId, String>, AppError> {
        let unique_ids: Vec<UserId> = ids
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let users = self.get_by_ids(&unique_ids).await?;
        Ok(users.into_iter().map(|u| (u.id, u.name)).collect())
    }
}

pub trait PasswordService: Send + Sync {
    fn hash_password(&self, password: &str) -> Result<String, AppError>;
    fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AppError>;
}
