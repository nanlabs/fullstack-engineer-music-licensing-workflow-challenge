use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::kernel::{MovieId, SceneId};

// ============================================================================
// Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub id: SceneId,
    pub movie_id: MovieId,
    pub title: String,
    pub scene_number: i32,
    pub description: Option<String>,
    pub start_time: i32,
    pub end_time: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Scene {
    pub fn new(
        movie_id: MovieId,
        title: String,
        scene_number: i32,
        start_time: i32,
        end_time: i32,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: SceneId::new(),
            movie_id,
            title,
            scene_number,
            description: None,
            start_time,
            end_time,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn duration_seconds(&self) -> i32 {
        self.end_time - self.start_time
    }
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSceneRequest {
    pub movie_id: MovieId,
    pub title: String,
    pub scene_number: i32,
    pub description: Option<String>,
    pub start_time: i32,
    pub end_time: i32,
}

impl CreateSceneRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.title.trim().is_empty() {
            return Err(AppError::validation("Title is required").with_detail("field", "title"));
        }
        if self.scene_number < 1 {
            return Err(AppError::validation("Scene number must be positive")
                .with_detail("field", "scene_number"));
        }
        if self.start_time < 0 {
            return Err(AppError::validation("Start time cannot be negative")
                .with_detail("field", "start_time"));
        }
        if self.end_time <= self.start_time {
            return Err(
                AppError::validation("End time must be greater than start time")
                    .with_detail("field", "end_time"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSceneRequest {
    pub title: Option<String>,
    pub scene_number: Option<i32>,
    pub description: Option<String>,
    pub start_time: Option<i32>,
    pub end_time: Option<i32>,
}

impl UpdateSceneRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(ref title) = self.title
            && title.trim().is_empty()
        {
            return Err(AppError::validation("Title cannot be empty").with_detail("field", "title"));
        }
        if let Some(num) = self.scene_number
            && num < 1
        {
            return Err(AppError::validation("Scene number must be positive")
                .with_detail("field", "scene_number"));
        }
        if let Some(start) = self.start_time
            && start < 0
        {
            return Err(AppError::validation("Start time cannot be negative")
                .with_detail("field", "start_time"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SceneResponse {
    pub id: SceneId,
    pub movie_id: MovieId,
    pub title: String,
    pub scene_number: i32,
    pub description: Option<String>,
    pub start_time: i32,
    pub end_time: i32,
    pub duration_seconds: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Scene> for SceneResponse {
    fn from(s: Scene) -> Self {
        let duration_seconds = s.duration_seconds();
        Self {
            id: s.id,
            movie_id: s.movie_id,
            title: s.title,
            scene_number: s.scene_number,
            description: s.description,
            start_time: s.start_time,
            end_time: s.end_time,
            duration_seconds,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}
