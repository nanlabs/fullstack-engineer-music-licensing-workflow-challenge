//! Track use cases.
//!
//! This layer owns the transaction boundary: a track change and the event that
//! records it commit together or not at all. There is no path that writes one
//! without the other.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::actor::Actor;
use crate::domain::event::{NewTrackEvent, TrackDefinition};
use crate::domain::track::{InvalidInterval, LicensingState, SceneInterval, Track};
use crate::infrastructure::track_repository as repository;

#[derive(Debug, thiserror::Error)]
pub enum TrackError {
    #[error("scene {0} does not exist")]
    SceneNotFound(Uuid),
    #[error("song {0} does not exist")]
    SongNotFound(Uuid),
    #[error("track {0} does not exist")]
    TrackNotFound(Uuid),
    #[error(transparent)]
    InvalidInterval(#[from] InvalidInterval),
    /// A lock wait exceeded `lock_timeout`: the request is retryable.
    #[error("write contention while updating the track")]
    WriteContention,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

impl TrackError {
    /// Classifies a database error, separating retryable lock contention from
    /// genuine failures.
    fn from_database(error: sqlx::Error) -> Self {
        // 55P03 lock_not_available: someone else holds the row we waited for.
        if let Some(code) = error.as_database_error().and_then(|error| error.code()) {
            if code == "55P03" {
                return Self::WriteContention;
            }
        }

        Self::Database(error)
    }
}

/// What a caller asked to create.
#[derive(Debug, Clone, Copy)]
pub struct NewTrack {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
}

/// Creates a track and its `TrackCreated` event in one transaction.
///
/// A new track always starts `Pending`: licensing has not been sought yet.
/// Duplicate tracks are permitted — the same song may be used twice in a scene
/// for different reasons — so this does not deduplicate on the definition.
pub async fn create_track(
    pool: &PgPool,
    actor: &Actor,
    request: NewTrack,
) -> Result<Track, TrackError> {
    let mut transaction = repository::begin_write(pool)
        .await
        .map_err(TrackError::from_database)?;

    // Reference rows are locked before the track is written, so the interval is
    // validated against a scene duration that cannot change under us.
    let scene = repository::lock_scene(&mut transaction, request.scene_id)
        .await
        .map_err(TrackError::from_database)?
        .ok_or(TrackError::SceneNotFound(request.scene_id))?;

    if !repository::lock_song(&mut transaction, request.song_id)
        .await
        .map_err(TrackError::from_database)?
    {
        return Err(TrackError::SongNotFound(request.song_id));
    }

    let interval = SceneInterval::new(
        request.scene_start_ms,
        request.scene_end_ms,
        scene.duration_ms,
    )?;

    let track_id = Uuid::new_v4();
    let track = repository::insert_track(
        &mut transaction,
        track_id,
        request.scene_id,
        request.song_id,
        interval,
        LicensingState::Pending,
    )
    .await
    .map_err(TrackError::from_database)?;

    let event = NewTrackEvent::created(
        track.id,
        scene.movie_id,
        actor.clone(),
        TrackDefinition {
            scene_id: track.scene_id,
            song_id: track.song_id,
            interval: track.interval,
            licensing_state: track.licensing_state,
        },
    );

    repository::insert_event(&mut transaction, &event)
        .await
        .map_err(TrackError::from_database)?;

    transaction
        .commit()
        .await
        .map_err(TrackError::from_database)?;

    tracing::info!(
        track_id = %track.id,
        scene_id = %track.scene_id,
        actor_id = %actor.id,
        "track created"
    );

    Ok(track)
}

pub async fn find_track(pool: &PgPool, track_id: Uuid) -> Result<Track, TrackError> {
    repository::find_track(pool, track_id)
        .await?
        .ok_or(TrackError::TrackNotFound(track_id))
}
