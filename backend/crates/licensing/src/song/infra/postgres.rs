use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{PageQuery, SongId, TenantId};
use sqlx::PgPool;

use crate::db::{like_pattern, violation, Violation};
use crate::song::port::SongRepository;
use crate::song::{RightsHolderKind, Song, SongError, SongFilter};

const COLUMNS: &str = "id, tenant_id, title, artist, album, release_year, duration_ms, isrc, iswc, \
                       rights_holder, rights_holder_kind, rights_holder_email, notes, created_at, updated_at";

/// Shared `WHERE` clause for listing: `$1` tenant, `$2` optional ILIKE pattern on title or artist.
const FILTER: &str = "tenant_id = $1 AND ($2::text IS NULL OR title ILIKE $2 OR artist ILIKE $2)";

/// Partial unique index from `0007_songs.sql`: one ISRC per tenant.
const ISRC_KEY: &str = "songs_tenant_isrc_key";

#[derive(sqlx::FromRow)]
struct SongRow {
    id: SongId,
    tenant_id: TenantId,
    title: String,
    artist: String,
    album: Option<String>,
    release_year: Option<i32>,
    duration_ms: Option<i32>,
    isrc: Option<String>,
    iswc: Option<String>,
    rights_holder: String,
    rights_holder_kind: Option<RightsHolderKind>,
    rights_holder_email: Option<String>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<SongRow> for Song {
    fn from(r: SongRow) -> Self {
        Song {
            id: r.id,
            tenant_id: r.tenant_id,
            title: r.title,
            artist: r.artist,
            album: r.album,
            release_year: r.release_year,
            duration_ms: r.duration_ms,
            isrc: r.isrc,
            iswc: r.iswc,
            rights_holder: r.rights_holder,
            rights_holder_kind: r.rights_holder_kind,
            rights_holder_email: r.rights_holder_email,
            notes: r.notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresSongRepository {
    pool: PgPool,
}

impl PostgresSongRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// A validated song can only trip the ISRC index on insert or update.
fn map_write_error(err: sqlx::Error) -> SongError {
    match violation(&err) {
        Some((Violation::Unique, Some(name))) if name == ISRC_KEY => SongError::IsrcTaken,
        _ => SongError::App(err.into()),
    }
}

/// Tracks reference songs with `ON DELETE RESTRICT`, so a foreign-key
/// violation on delete means "still in use".
fn map_delete_error(err: sqlx::Error) -> SongError {
    match violation(&err) {
        Some((Violation::ForeignKey, _)) => SongError::InUse,
        _ => SongError::App(err.into()),
    }
}

#[async_trait]
impl SongRepository for PostgresSongRepository {
    async fn get(&self, tenant_id: TenantId, id: SongId) -> AppResult<Option<Song>> {
        let row =
            sqlx::query_as::<_, SongRow>(&format!("SELECT {COLUMNS} FROM songs WHERE tenant_id = $1 AND id = $2"))
                .bind(tenant_id)
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(row.map(Into::into))
    }

    async fn list(&self, tenant_id: TenantId, filter: &SongFilter, page: PageQuery) -> AppResult<(Vec<Song>, u64)> {
        let pattern = filter.term().map(like_pattern);
        let rows = sqlx::query_as::<_, SongRow>(&format!(
            "SELECT {COLUMNS} FROM songs WHERE {FILTER} ORDER BY lower(title), id LIMIT $3 OFFSET $4"
        ))
        .bind(tenant_id)
        .bind(&pattern)
        .bind(page.limit())
        .bind(page.offset())
        .fetch_all(&self.pool)
        .await?;
        let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM songs WHERE {FILTER}"))
            .bind(tenant_id)
            .bind(&pattern)
            .fetch_one(&self.pool)
            .await?;
        Ok((rows.into_iter().map(Into::into).collect(), total.max(0) as u64))
    }

    async fn insert(&self, song: &Song) -> Result<(), SongError> {
        sqlx::query(
            "INSERT INTO songs (id, tenant_id, title, artist, album, release_year, duration_ms, isrc, iswc, \
             rights_holder, rights_holder_kind, rights_holder_email, notes, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
        )
        .bind(song.id)
        .bind(song.tenant_id)
        .bind(&song.title)
        .bind(&song.artist)
        .bind(&song.album)
        .bind(song.release_year)
        .bind(song.duration_ms)
        .bind(&song.isrc)
        .bind(&song.iswc)
        .bind(&song.rights_holder)
        .bind(song.rights_holder_kind.map(RightsHolderKind::as_str))
        .bind(&song.rights_holder_email)
        .bind(&song.notes)
        .bind(song.created_at)
        .bind(song.updated_at)
        .execute(&self.pool)
        .await
        .map_err(map_write_error)?;
        Ok(())
    }

    async fn update(&self, song: &Song) -> Result<Option<Song>, SongError> {
        let row = sqlx::query_as::<_, SongRow>(&format!(
            "UPDATE songs SET title = $3, artist = $4, album = $5, release_year = $6, duration_ms = $7, \
             isrc = $8, iswc = $9, rights_holder = $10, rights_holder_kind = $11, rights_holder_email = $12, \
             notes = $13, updated_at = $14 \
             WHERE tenant_id = $1 AND id = $2 RETURNING {COLUMNS}"
        ))
        .bind(song.tenant_id)
        .bind(song.id)
        .bind(&song.title)
        .bind(&song.artist)
        .bind(&song.album)
        .bind(song.release_year)
        .bind(song.duration_ms)
        .bind(&song.isrc)
        .bind(&song.iswc)
        .bind(&song.rights_holder)
        .bind(song.rights_holder_kind.map(RightsHolderKind::as_str))
        .bind(&song.rights_holder_email)
        .bind(&song.notes)
        .bind(song.updated_at)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_write_error)?;
        Ok(row.map(Into::into))
    }

    async fn delete(&self, tenant_id: TenantId, id: SongId) -> Result<bool, SongError> {
        let result = sqlx::query("DELETE FROM songs WHERE tenant_id = $1 AND id = $2")
            .bind(tenant_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_delete_error)?;
        Ok(result.rows_affected() > 0)
    }
}
