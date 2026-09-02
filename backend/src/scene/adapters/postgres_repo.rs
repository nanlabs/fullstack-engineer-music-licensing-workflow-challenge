use sqlx::PgPool;

use crate::error::AppError;
use crate::kernel::{MovieId, SceneId};

use super::super::model::Scene;
use super::super::port::SceneRepository;

const SCENE_COLUMNS: &str =
    "id, movie_id, title, scene_number, description, start_time, end_time, created_at, updated_at";

pub struct PostgresSceneRepository {
    pool: PgPool,
}

impl PostgresSceneRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn scene_from_row(row: &sqlx::postgres::PgRow) -> Result<Scene, AppError> {
    use sqlx::Row;
    Ok(Scene {
        id: SceneId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        movie_id: MovieId::from_string(
            row.try_get("movie_id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        title: row
            .try_get("title")
            .map_err(|e| AppError::internal(e.to_string()))?,
        scene_number: row
            .try_get("scene_number")
            .map_err(|e| AppError::internal(e.to_string()))?,
        description: row
            .try_get("description")
            .map_err(|e| AppError::internal(e.to_string()))?,
        start_time: row
            .try_get("start_time")
            .map_err(|e| AppError::internal(e.to_string()))?,
        end_time: row
            .try_get("end_time")
            .map_err(|e| AppError::internal(e.to_string()))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
    })
}

#[async_trait::async_trait]
impl SceneRepository for PostgresSceneRepository {
    async fn save(&self, scene: &Scene) -> Result<(), AppError> {
        sqlx::query(&format!(
            "INSERT INTO scenes ({SCENE_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        ))
        .bind(scene.id.as_str())
        .bind(scene.movie_id.as_str())
        .bind(&scene.title)
        .bind(scene.scene_number)
        .bind(&scene.description)
        .bind(scene.start_time)
        .bind(scene.end_time)
        .bind(scene.created_at)
        .bind(scene.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn get_by_id(&self, id: &SceneId) -> Result<Option<Scene>, AppError> {
        let row = sqlx::query(&format!("SELECT {SCENE_COLUMNS} FROM scenes WHERE id = $1"))
            .bind(id.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(scene_from_row).transpose()
    }

    async fn list_by_movie(&self, movie_id: &MovieId) -> Result<Vec<Scene>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {SCENE_COLUMNS} FROM scenes WHERE movie_id = $1 ORDER BY scene_number ASC"
        ))
        .bind(movie_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        rows.iter().map(scene_from_row).collect()
    }

    async fn update(&self, scene: &Scene) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE scenes SET title = $1, scene_number = $2, description = $3, start_time = $4, end_time = $5, updated_at = $6 WHERE id = $7",
        )
        .bind(&scene.title)
        .bind(scene.scene_number)
        .bind(&scene.description)
        .bind(scene.start_time)
        .bind(scene.end_time)
        .bind(scene.updated_at)
        .bind(scene.id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &SceneId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM scenes WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }
}
