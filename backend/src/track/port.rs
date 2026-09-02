use crate::error::AppError;
use crate::kernel::{SceneId, SongId, TrackId};

use super::model::Track;

#[async_trait::async_trait]
pub trait TrackRepository: Send + Sync {
    async fn save(&self, track: &Track) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &TrackId) -> Result<Option<Track>, AppError>;
    async fn list_by_scene(&self, scene_id: &SceneId) -> Result<Vec<Track>, AppError>;
    async fn list_by_song(&self, song_id: &SongId) -> Result<Vec<Track>, AppError>;
    async fn get_by_scene_and_song(
        &self,
        scene_id: &SceneId,
        song_id: &SongId,
    ) -> Result<Option<Track>, AppError>;
    async fn update(&self, track: &Track) -> Result<(), AppError>;
    async fn delete(&self, id: &TrackId) -> Result<(), AppError>;
}
