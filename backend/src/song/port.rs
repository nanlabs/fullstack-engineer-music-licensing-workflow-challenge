use crate::error::AppError;
use crate::kernel::{LabelId, SongId, UserId};

use super::model::{Song, SongFilter};
use crate::kernel::{Paginated, PaginationOptions};

#[async_trait::async_trait]
pub trait SongRepository: Send + Sync {
    async fn save(&self, song: &Song) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &SongId) -> Result<Option<Song>, AppError>;
    async fn find(
        &self,
        opts: &PaginationOptions,
        filter: &SongFilter,
    ) -> Result<Paginated<Song>, AppError>;
    async fn update(&self, song: &Song) -> Result<(), AppError>;
    async fn delete(&self, id: &SongId) -> Result<(), AppError>;
    async fn list_by_artist(&self, artist_id: &UserId) -> Result<Vec<Song>, AppError>;
    async fn list_by_label(&self, label_id: &LabelId) -> Result<Vec<Song>, AppError>;
}
