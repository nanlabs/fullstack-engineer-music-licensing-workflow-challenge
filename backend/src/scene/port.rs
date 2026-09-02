use crate::error::AppError;
use crate::kernel::{MovieId, SceneId};

use super::model::Scene;

#[async_trait::async_trait]
pub trait SceneRepository: Send + Sync {
    async fn save(&self, scene: &Scene) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &SceneId) -> Result<Option<Scene>, AppError>;
    async fn list_by_movie(&self, movie_id: &MovieId) -> Result<Vec<Scene>, AppError>;
    async fn update(&self, scene: &Scene) -> Result<(), AppError>;
    async fn delete(&self, id: &SceneId) -> Result<(), AppError>;
}
