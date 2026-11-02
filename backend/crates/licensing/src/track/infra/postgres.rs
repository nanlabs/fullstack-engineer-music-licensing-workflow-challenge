use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::{AppError, AppResult};
use kernel::{MovieId, SceneId, SongId, TenantId, TrackId};
use sqlx::PgPool;

use crate::db::{violation, Violation};
use crate::license::infra::postgres::insert_pending;
use crate::license::{License, LicenseState, ACTIVE_STATES_SQL};
use crate::scene::SceneError;
use crate::track::port::TrackRepository;
use crate::track::{SongSummary, Track, TrackError, TrackUsage, TrackView};

/// Every read joins the scene (for `movie_id`), the song (for the summary)
/// and the license (every track has exactly one). The column list and the
/// joins are separate so another adapter can select the same view next to
/// its own columns (the license adapter does, for the replay of
/// `license_events`); they assume the `tracks` table is aliased `t`.
pub(crate) const VIEW_COLUMNS: &str = "t.id, t.tenant_id, t.scene_id, s.movie_id, t.song_id, t.start_ms, t.end_ms, \
                                       t.usage, t.created_at, t.updated_at, so.title AS song_title, \
                                       so.artist AS song_artist, so.rights_holder AS song_rights_holder, \
                                       l.state AS license_state, l.version AS license_version, \
                                       l.expires_at AS license_expires_at, l.created_at AS license_created_at, \
                                       l.updated_at AS license_updated_at";
pub(crate) const VIEW_JOINS: &str =
    "JOIN scenes s ON s.id = t.scene_id JOIN songs so ON so.id = t.song_id JOIN licenses l ON l.track_id = t.id";

/// The full view query, to be followed by a `WHERE`.
fn select() -> String {
    format!("SELECT {VIEW_COLUMNS} FROM tracks t {VIEW_JOINS}")
}

/// Named foreign keys from `0009_tracks.sql`.
const SCENE_FKEY: &str = "tracks_scene_fkey";
const SONG_FKEY: &str = "tracks_song_fkey";

/// The guard of `update` and `delete`: no row is touched while the track's
/// license is active. Evaluated by the same statement as the write, so a
/// transition committing after the service's check still freezes the cue.
fn not_locked() -> String {
    format!("NOT EXISTS (SELECT 1 FROM licenses l WHERE l.track_id = tracks.id AND l.state IN {ACTIVE_STATES_SQL})")
}

/// One row of the view; `pub(crate)` so it can be `#[sqlx(flatten)]`ed into
/// another adapter's row.
#[derive(sqlx::FromRow)]
pub(crate) struct TrackRow {
    id: TrackId,
    tenant_id: TenantId,
    scene_id: SceneId,
    movie_id: MovieId,
    song_id: SongId,
    start_ms: i32,
    end_ms: i32,
    usage: TrackUsage,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    song_title: String,
    song_artist: String,
    song_rights_holder: String,
    license_state: LicenseState,
    license_version: i32,
    license_expires_at: Option<DateTime<Utc>>,
    license_created_at: DateTime<Utc>,
    license_updated_at: DateTime<Utc>,
}

impl From<TrackRow> for TrackView {
    fn from(r: TrackRow) -> Self {
        TrackView {
            track: Track {
                id: r.id,
                tenant_id: r.tenant_id,
                scene_id: r.scene_id,
                song_id: r.song_id,
                start_ms: r.start_ms,
                end_ms: r.end_ms,
                usage: r.usage,
                created_at: r.created_at,
                updated_at: r.updated_at,
            },
            movie_id: r.movie_id,
            song: SongSummary {
                id: r.song_id,
                title: r.song_title,
                artist: r.song_artist,
                rights_holder: r.song_rights_holder,
            },
            license: License {
                track_id: r.id,
                tenant_id: r.tenant_id,
                state: r.license_state,
                version: r.license_version,
                expires_at: r.license_expires_at,
                created_at: r.license_created_at,
                updated_at: r.license_updated_at,
            },
        }
    }
}

pub struct PostgresTrackRepository {
    pool: PgPool,
}

impl PostgresTrackRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn fetch(&self, tenant_id: TenantId, id: TrackId) -> AppResult<Option<TrackView>> {
        let select = select();
        let row = sqlx::query_as::<_, TrackRow>(&format!("{select} WHERE t.tenant_id = $1 AND t.id = $2"))
            .bind(tenant_id)
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(Into::into))
    }
}

/// A validated track can only trip the two composite foreign keys: the song
/// one when the body names a song of another tenant (or none), the scene one
/// if the scene vanished between the service check and the write.
fn map_write_error(err: sqlx::Error) -> TrackError {
    match violation(&err) {
        Some((Violation::ForeignKey, Some(name))) if name == SONG_FKEY => TrackError::UnknownSong,
        Some((Violation::ForeignKey, Some(name))) if name == SCENE_FKEY => TrackError::Scene(SceneError::NotFound),
        _ => TrackError::App(err.into()),
    }
}

#[async_trait]
impl TrackRepository for PostgresTrackRepository {
    async fn get(&self, tenant_id: TenantId, id: TrackId) -> AppResult<Option<TrackView>> {
        self.fetch(tenant_id, id).await
    }

    async fn list_by_scene(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>> {
        let select = select();
        let rows = sqlx::query_as::<_, TrackRow>(&format!(
            "{select} WHERE t.tenant_id = $1 AND t.scene_id = $2 AND ($3::text IS NULL OR l.state = $3) \
             ORDER BY t.start_ms, t.end_ms, t.id"
        ))
        .bind(tenant_id)
        .bind(scene_id)
        .bind(state.map(LicenseState::as_str))
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn list_by_movie(
        &self,
        tenant_id: TenantId,
        movie_id: MovieId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>> {
        let select = select();
        let rows = sqlx::query_as::<_, TrackRow>(&format!(
            "{select} WHERE t.tenant_id = $1 AND s.movie_id = $2 AND ($3::text IS NULL OR l.state = $3) \
             ORDER BY s.position, t.start_ms, t.end_ms, t.id"
        ))
        .bind(tenant_id)
        .bind(movie_id)
        .bind(state.map(LicenseState::as_str))
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn insert(&self, track: &Track) -> Result<TrackView, TrackError> {
        let mut tx = self.pool.begin().await.map_err(AppError::from)?;
        sqlx::query(
            "INSERT INTO tracks (id, tenant_id, scene_id, song_id, start_ms, end_ms, usage, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(track.id)
        .bind(track.tenant_id)
        .bind(track.scene_id)
        .bind(track.song_id)
        .bind(track.start_ms)
        .bind(track.end_ms)
        .bind(track.usage.as_str())
        .bind(track.created_at)
        .bind(track.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(map_write_error)?;
        // The license is born with the track: same transaction, pending.
        insert_pending(&mut tx, &License::pending(track.id, track.tenant_id, track.created_at))
            .await
            .map_err(AppError::from)?;
        tx.commit().await.map_err(AppError::from)?;
        let view = self
            .fetch(track.tenant_id, track.id)
            .await?
            .ok_or_else(|| AppError::internal("Track missing right after insert"))?;
        Ok(view)
    }

    async fn update(&self, track: &Track) -> Result<Option<TrackView>, TrackError> {
        let not_locked = not_locked();
        let updated = sqlx::query(&format!(
            "UPDATE tracks SET song_id = $3, start_ms = $4, end_ms = $5, usage = $6, updated_at = $7 \
             WHERE tenant_id = $1 AND id = $2 AND {not_locked}"
        ))
        .bind(track.tenant_id)
        .bind(track.id)
        .bind(track.song_id)
        .bind(track.start_ms)
        .bind(track.end_ms)
        .bind(track.usage.as_str())
        .bind(track.updated_at)
        .execute(&self.pool)
        .await
        .map_err(map_write_error)?
        .rows_affected();
        if updated == 0 {
            return Ok(None);
        }
        Ok(self.fetch(track.tenant_id, track.id).await?)
    }

    async fn delete(&self, tenant_id: TenantId, id: TrackId) -> AppResult<bool> {
        let not_locked = not_locked();
        let result = sqlx::query(&format!(
            "DELETE FROM tracks WHERE tenant_id = $1 AND id = $2 AND {not_locked}"
        ))
        .bind(tenant_id)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn locked_in_scene(&self, tenant_id: TenantId, scene_id: SceneId) -> AppResult<Vec<TrackId>> {
        let ids = sqlx::query_scalar::<_, TrackId>(&format!(
            "SELECT t.id FROM tracks t JOIN licenses l ON l.track_id = t.id \
             WHERE t.tenant_id = $1 AND t.scene_id = $2 AND l.state IN {ACTIVE_STATES_SQL} \
             ORDER BY t.start_ms, t.id"
        ))
        .bind(tenant_id)
        .bind(scene_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(ids)
    }

    async fn locked_in_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<TrackId>> {
        let ids = sqlx::query_scalar::<_, TrackId>(&format!(
            "SELECT t.id FROM tracks t JOIN scenes s ON s.id = t.scene_id JOIN licenses l ON l.track_id = t.id \
             WHERE t.tenant_id = $1 AND s.movie_id = $2 AND l.state IN {ACTIVE_STATES_SQL} \
             ORDER BY s.position, t.start_ms, t.id"
        ))
        .bind(tenant_id)
        .bind(movie_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(ids)
    }

    async fn outside_window(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        start_ms: i32,
        end_ms: i32,
    ) -> AppResult<Vec<TrackId>> {
        let ids = sqlx::query_scalar::<_, TrackId>(
            "SELECT id FROM tracks WHERE tenant_id = $1 AND scene_id = $2 AND (start_ms < $3 OR end_ms > $4) \
             ORDER BY start_ms, id",
        )
        .bind(tenant_id)
        .bind(scene_id)
        .bind(start_ms)
        .bind(end_ms)
        .fetch_all(&self.pool)
        .await?;
        Ok(ids)
    }
}
