use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::kernel::{LabelId, Paginated, PaginationOptions, SongId, UserId};
use crate::song::model::{Song, SongFilter};
use crate::song::port::SongRepository;

const SONG_COLUMNS: &str =
    "id, title, artist_id, label_id, album, duration_seconds, genre, isrc, created_at, updated_at";

pub struct PostgresSongRepository {
    pool: PgPool,
}

impl PostgresSongRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl SongRepository for PostgresSongRepository {
    async fn save(&self, song: &Song) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO songs (id, title, artist_id, label_id, album, duration_seconds, genre, isrc, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(song.id.as_str())
        .bind(&song.title)
        .bind(song.artist_id.as_str())
        .bind(song.label_id.as_ref().map(|l| l.as_str()))
        .bind(&song.album)
        .bind(song.duration_seconds)
        .bind(&song.genre)
        .bind(&song.isrc)
        .bind(song.created_at)
        .bind(song.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_by_id(&self, id: &SongId) -> Result<Option<Song>, AppError> {
        let row = sqlx::query(&format!("SELECT {SONG_COLUMNS} FROM songs WHERE id = $1"))
            .bind(id.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(song_from_row).transpose()
    }

    async fn find(
        &self,
        opts: &PaginationOptions,
        filter: &SongFilter,
    ) -> Result<Paginated<Song>, AppError> {
        let search_pattern = filter.search.as_ref().map(|s| format!("%{s}%"));
        let artist_id = filter.artist_id.as_ref().map(|a| a.as_str().to_string());
        let label_id = filter.label_id.as_ref().map(|l| l.as_str().to_string());

        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM songs
            WHERE ($1::text IS NULL OR title ILIKE $1)
              AND ($2::text IS NULL OR artist_id = $2)
              AND ($3::text IS NULL OR label_id = $3)
              AND ($4::text IS NULL OR genre = $4)
            "#,
        )
        .bind(&search_pattern)
        .bind(&artist_id)
        .bind(&label_id)
        .bind(&filter.genre)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {SONG_COLUMNS}
            FROM songs
            WHERE ($1::text IS NULL OR title ILIKE $1)
              AND ($2::text IS NULL OR artist_id = $2)
              AND ($3::text IS NULL OR label_id = $3)
              AND ($4::text IS NULL OR genre = $4)
            ORDER BY created_at DESC
            LIMIT $5 OFFSET $6
            "#
        ))
        .bind(&search_pattern)
        .bind(&artist_id)
        .bind(&label_id)
        .bind(&filter.genre)
        .bind(opts.limit())
        .bind(opts.offset())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        let songs: Result<Vec<Song>, AppError> = rows.iter().map(song_from_row).collect();
        Ok(Paginated::new(songs?, opts.page, opts.page_size, total))
    }

    async fn update(&self, song: &Song) -> Result<(), AppError> {
        sqlx::query(
            r#"
            UPDATE songs
            SET title = $2, album = $3, duration_seconds = $4, genre = $5, isrc = $6, updated_at = $7
            WHERE id = $1
            "#,
        )
        .bind(song.id.as_str())
        .bind(&song.title)
        .bind(&song.album)
        .bind(song.duration_seconds)
        .bind(&song.genre)
        .bind(&song.isrc)
        .bind(song.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn delete(&self, id: &SongId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM songs WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn list_by_artist(&self, artist_id: &UserId) -> Result<Vec<Song>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {SONG_COLUMNS} FROM songs WHERE artist_id = $1 ORDER BY created_at DESC"
        ))
        .bind(artist_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(song_from_row).collect()
    }

    async fn list_by_label(&self, label_id: &LabelId) -> Result<Vec<Song>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {SONG_COLUMNS} FROM songs WHERE label_id = $1 ORDER BY created_at DESC"
        ))
        .bind(label_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(song_from_row).collect()
    }
}

fn song_from_row(row: &sqlx::postgres::PgRow) -> Result<Song, AppError> {
    Ok(Song {
        id: SongId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        ),
        title: row
            .try_get("title")
            .map_err(|e| AppError::internal(format!("Failed to read column 'title': {e}")))?,
        artist_id: UserId::from_string(
            row.try_get("artist_id").map_err(|e| {
                AppError::internal(format!("Failed to read column 'artist_id': {e}"))
            })?,
        ),
        label_id: row
            .try_get::<Option<String>, _>("label_id")
            .map_err(|e| AppError::internal(format!("Failed to read column 'label_id': {e}")))?
            .map(LabelId::from_string),
        album: row
            .try_get("album")
            .map_err(|e| AppError::internal(format!("Failed to read column 'album': {e}")))?,
        duration_seconds: row.try_get("duration_seconds").map_err(|e| {
            AppError::internal(format!("Failed to read column 'duration_seconds': {e}"))
        })?,
        genre: row
            .try_get("genre")
            .map_err(|e| AppError::internal(format!("Failed to read column 'genre': {e}")))?,
        isrc: row
            .try_get("isrc")
            .map_err(|e| AppError::internal(format!("Failed to read column 'isrc': {e}")))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'updated_at': {e}")))?,
    })
}
