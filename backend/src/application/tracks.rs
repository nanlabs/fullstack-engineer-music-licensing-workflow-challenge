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
    #[error("cannot move licensing state from {from:?} to {to:?}")]
    InvalidStateTransition {
        from: LicensingState,
        to: LicensingState,
    },
    #[error("expected version {expected} but the track is at version {actual}")]
    VersionConflict { expected: i32, actual: i32 },
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

/// Sets a track's licensing state.
///
/// The rules, in the order they are evaluated:
///
/// 1. **Already there** — the track is in the requested state. This succeeds as
///    a no-op without bumping the version or writing an event, *whatever*
///    `expected_version` says. A retry whose desired result already holds has
///    nothing to disagree about, so it is not a conflict.
/// 2. **Stale version** — the caller's `expected_version` is not the current
///    one, and they are asking for something other than the current state.
///    Their intent was formed against a track that has since moved, so this is
///    a `409`.
/// 3. **Illegal transition** — the move is not in the transition table.
/// 4. Otherwise the change commits: version incremented, event appended.
///
/// Step 1 preceding step 2 is what makes the endpoint safely retryable: a
/// client that never sees its response can repeat the request and get success
/// rather than a conflict it cannot act on.
pub async fn set_licensing_state(
    pool: &PgPool,
    actor: &Actor,
    track_id: Uuid,
    desired: LicensingState,
    expected_version: i32,
) -> Result<Track, TrackError> {
    let mut transaction = repository::begin_write(pool)
        .await
        .map_err(TrackError::from_database)?;

    let locked = repository::lock_track(&mut transaction, track_id)
        .await
        .map_err(TrackError::from_database)?
        .ok_or(TrackError::TrackNotFound(track_id))?;

    let current = locked.track;

    // 1. Already in the requested state: nothing to do, and nothing to record.
    if current.licensing_state == desired {
        // The read lock is released by rolling back rather than committing,
        // since no work was done.
        transaction
            .rollback()
            .await
            .map_err(TrackError::from_database)?;

        tracing::debug!(
            track_id = %track_id,
            state = current.licensing_state.as_str(),
            "licensing state already set; no-op"
        );
        return Ok(current);
    }

    // 2. The caller's intent was formed against a different version.
    if current.version != expected_version {
        return Err(TrackError::VersionConflict {
            expected: expected_version,
            actual: current.version,
        });
    }

    // 3. The transition table has the final say.
    if !current.licensing_state.can_transition_to(desired) {
        return Err(TrackError::InvalidStateTransition {
            from: current.licensing_state,
            to: desired,
        });
    }

    let updated = repository::update_licensing_state(&mut transaction, track_id, desired)
        .await
        .map_err(TrackError::from_database)?;

    let event = NewTrackEvent::licensing_state_changed(
        updated.id,
        locked.movie_id,
        updated.version,
        actor.clone(),
        current.licensing_state,
        desired,
    );

    repository::insert_event(&mut transaction, &event)
        .await
        .map_err(TrackError::from_database)?;

    transaction
        .commit()
        .await
        .map_err(TrackError::from_database)?;

    tracing::info!(
        track_id = %updated.id,
        from = current.licensing_state.as_str(),
        to = desired.as_str(),
        version = updated.version,
        actor_id = %actor.id,
        "licensing state changed"
    );

    Ok(updated)
}

pub async fn find_track(pool: &PgPool, track_id: Uuid) -> Result<Track, TrackError> {
    repository::find_track(pool, track_id)
        .await?
        .ok_or(TrackError::TrackNotFound(track_id))
}
