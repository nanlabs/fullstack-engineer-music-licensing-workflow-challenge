use crate::error::AppError;
use crate::kernel::{MovieId, Paginated, PaginationOptions, UserId};

use super::model::{Movie, MovieFilter, MovieMember};

#[async_trait::async_trait]
pub trait MovieRepository: Send + Sync {
    async fn save(&self, movie: &Movie) -> Result<(), AppError>;
    /// Atomically persist a movie together with its owner membership.
    /// The "every movie has an owner" invariant must never be observable as broken.
    async fn save_with_owner(&self, movie: &Movie, owner: &MovieMember) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &MovieId) -> Result<Option<Movie>, AppError>;
    async fn find(
        &self,
        opts: &PaginationOptions,
        filter: &MovieFilter,
    ) -> Result<Paginated<Movie>, AppError>;
    async fn update(&self, movie: &Movie) -> Result<(), AppError>;
    async fn delete(&self, id: &MovieId) -> Result<(), AppError>;
    async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError>;

    // Membership
    async fn add_member(&self, member: &MovieMember) -> Result<(), AppError>;
    async fn remove_member(&self, movie_id: &MovieId, user_id: &UserId) -> Result<(), AppError>;
    async fn get_member(
        &self,
        movie_id: &MovieId,
        user_id: &UserId,
    ) -> Result<Option<MovieMember>, AppError>;
    async fn list_members(&self, movie_id: &MovieId) -> Result<Vec<MovieMember>, AppError>;
    async fn get_user_movies(&self, user_id: &UserId) -> Result<Vec<Movie>, AppError>;
}
