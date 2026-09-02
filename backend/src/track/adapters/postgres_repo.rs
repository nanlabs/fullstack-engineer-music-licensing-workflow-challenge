use sqlx::PgPool;

use crate::error::AppError;
use crate::kernel::{SceneId, SongId, TrackId, UserId};

use super::super::model::{Track, UsageType};
use super::super::port::TrackRepository;

const TRACK_COLUMNS: &str = "id, scene_id, song_id, usage_type, start_time_seconds, \
    end_time_seconds, created_by, notes, created_at, updated_at";

pub struct PostgresTrackRepository {
    pool: PgPool,
}

impl PostgresTrackRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn track_from_row(row: &sqlx::postgres::PgRow) -> Result<Track, AppError> {
    use sqlx::Row;
    let usage_str: String = row
        .try_get("usage_type")
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Track {
        id: TrackId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        scene_id: SceneId::from_string(
            row.try_get("scene_id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        song_id: SongId::from_string(
            row.try_get("song_id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        usage_type: UsageType::try_from(usage_str.as_str())?,
        start_time_seconds: row
            .try_get("start_time_seconds")
            .map_err(|e| AppError::internal(e.to_string()))?,
        end_time_seconds: row
            .try_get("end_time_seconds")
            .map_err(|e| AppError::internal(e.to_string()))?,
        created_by: UserId::from_string(
            row.try_get("created_by")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        notes: row
            .try_get("notes")
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
impl TrackRepository for PostgresTrackRepository {
    async fn save(&self, track: &Track) -> Result<(), AppError> {
        sqlx::query(&format!(
            "INSERT INTO tracks ({TRACK_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
        ))
        .bind(track.id.as_str())
        .bind(track.scene_id.as_str())
        .bind(track.song_id.as_str())
        .bind(track.usage_type.as_str())
        .bind(track.start_time_seconds)
        .bind(track.end_time_seconds)
        .bind(track.created_by.as_str())
        .bind(&track.notes)
        .bind(track.created_at)
        .bind(track.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn get_by_id(&self, id: &TrackId) -> Result<Option<Track>, AppError> {
        let row = sqlx::query(&format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = $1"))
            .bind(id.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(track_from_row).transpose()
    }

    async fn list_by_scene(&self, scene_id: &SceneId) -> Result<Vec<Track>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE scene_id = $1 ORDER BY created_at ASC"
        ))
        .bind(scene_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        rows.iter().map(track_from_row).collect()
    }

    async fn list_by_song(&self, song_id: &SongId) -> Result<Vec<Track>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE song_id = $1 ORDER BY created_at ASC"
        ))
        .bind(song_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        rows.iter().map(track_from_row).collect()
    }

    async fn get_by_scene_and_song(
        &self,
        scene_id: &SceneId,
        song_id: &SongId,
    ) -> Result<Option<Track>, AppError> {
        let row = sqlx::query(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE scene_id = $1 AND song_id = $2"
        ))
        .bind(scene_id.as_str())
        .bind(song_id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(track_from_row).transpose()
    }

    async fn update(&self, track: &Track) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE tracks SET usage_type = $1, start_time_seconds = $2, end_time_seconds = $3, \
             notes = $4, updated_at = $5 WHERE id = $6",
        )
        .bind(track.usage_type.as_str())
        .bind(track.start_time_seconds)
        .bind(track.end_time_seconds)
        .bind(&track.notes)
        .bind(track.updated_at)
        .bind(track.id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &TrackId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM tracks WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }
}
