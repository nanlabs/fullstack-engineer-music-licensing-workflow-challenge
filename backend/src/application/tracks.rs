//! Track use cases.
//!
//! This layer owns the transaction boundary: a track change and the event that
//! records it commit together or not at all. There is no path that writes one
//! without the other.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::actor::Actor;
use crate::domain::event::{NewTrackEvent, TrackDefinition};
use crate::domain::track::{InvalidInterval, LicensingState, SceneInterval, Track};
use crate::infrastructure::track_repository::{self as repository, StoredEvent, TrackWithSong};

#[derive(Debug, thiserror::Error)]
pub enum TrackError {
    #[error("scene {0} does not exist")]
    SceneNotFound(Uuid),
    #[error("song {0} does not exist")]
    SongNotFound(Uuid),
    #[error("track {0} does not exist")]
    TrackNotFound(Uuid),
    #[error("movie {0} does not exist")]
    MovieNotFound(Uuid),
    #[error("scene {scene_id} does not belong to movie {movie_id}")]
    SceneOutsideMovie { scene_id: Uuid, movie_id: Uuid },
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

/// A complete desired definition for an existing track.
#[derive(Debug, Clone, Copy)]
pub struct TrackRevision {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
}

/// Revises a track's definition.
///
/// # Revision resets licensing
///
/// Any material change — song, scene, or interval — resets licensing to
/// `Pending`, because permission was granted for a *specific* use and this is
/// no longer that use. This applies from terminal states too, and that is
/// deliberate:
///
/// - revising a `Licensed` or `Rejected` track starts a new proposition;
/// - revising a `Cancelled` track explicitly revives it.
///
/// The former outcome is not lost: the revision event records the previous
/// definition, including the state the track was in.
///
/// # Idempotency
///
/// A revision that asks for the definition the track already has is a no-op:
/// no licensing reset, no version bump, no event. As with the state endpoint,
/// this is checked before `expected_version`, so a retry of a request whose
/// result already holds succeeds rather than conflicting.
///
/// # Scene relocation
///
/// A track may move between scenes of the same movie. Moving it to another
/// movie is refused: that is a different piece of work, and the track's history
/// belongs to the movie it was created under.
pub async fn revise_track(
    pool: &PgPool,
    actor: &Actor,
    track_id: Uuid,
    revision: TrackRevision,
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

    // The target scene is read and locked before anything is written, so the
    // interval is validated against a duration that cannot change under us.
    let scene = repository::lock_scene(&mut transaction, revision.scene_id)
        .await
        .map_err(TrackError::from_database)?
        .ok_or(TrackError::SceneNotFound(revision.scene_id))?;

    if scene.movie_id != locked.movie_id {
        return Err(TrackError::SceneOutsideMovie {
            scene_id: revision.scene_id,
            movie_id: locked.movie_id,
        });
    }

    if !repository::lock_song(&mut transaction, revision.song_id)
        .await
        .map_err(TrackError::from_database)?
    {
        return Err(TrackError::SongNotFound(revision.song_id));
    }

    let interval = SceneInterval::new(
        revision.scene_start_ms,
        revision.scene_end_ms,
        scene.duration_ms,
    )?;

    // Nothing material differs: the caller already has what they asked for.
    let unchanged = current.scene_id == revision.scene_id
        && current.song_id == revision.song_id
        && current.interval == interval;

    if unchanged {
        transaction
            .rollback()
            .await
            .map_err(TrackError::from_database)?;

        tracing::debug!(track_id = %track_id, "revision matches current definition; no-op");
        return Ok(current);
    }

    if current.version != expected_version {
        return Err(TrackError::VersionConflict {
            expected: expected_version,
            actual: current.version,
        });
    }

    let previous = TrackDefinition {
        scene_id: current.scene_id,
        song_id: current.song_id,
        interval: current.interval,
        licensing_state: current.licensing_state,
    };

    let updated = repository::update_definition(
        &mut transaction,
        track_id,
        revision.scene_id,
        revision.song_id,
        interval,
        LicensingState::Pending,
    )
    .await
    .map_err(TrackError::from_database)?;

    let event = NewTrackEvent::revised(
        updated.id,
        locked.movie_id,
        updated.version,
        actor.clone(),
        previous,
        TrackDefinition {
            scene_id: updated.scene_id,
            song_id: updated.song_id,
            interval: updated.interval,
            licensing_state: updated.licensing_state,
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
        track_id = %updated.id,
        previous_state = previous.licensing_state.as_str(),
        relocated = previous.scene_id != updated.scene_id,
        version = updated.version,
        actor_id = %actor.id,
        "track revised; licensing reset to pending"
    );

    Ok(updated)
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

/// Page size plus the lookahead row the pagination helper expects.
fn fetch_limit(limit: u32) -> i64 {
    i64::from(limit) + 1
}

/// Lists the tracks of one scene.
///
/// `states` filters by licensing state; `None` includes everything, cancelled
/// tracks included, because a cancelled use is still part of the record.
pub async fn list_scene_tracks(
    pool: &PgPool,
    scene_id: Uuid,
    states: Option<Vec<LicensingState>>,
    after: Option<(DateTime<Utc>, Uuid)>,
    limit: u32,
) -> Result<Vec<TrackWithSong>, TrackError> {
    if !repository::scene_exists(pool, scene_id).await? {
        return Err(TrackError::SceneNotFound(scene_id));
    }

    Ok(repository::list_scene_tracks(
        pool,
        scene_id,
        state_names(states),
        after,
        fetch_limit(limit),
    )
    .await?)
}

/// Lists every track in a movie, across all of its scenes.
pub async fn list_movie_tracks(
    pool: &PgPool,
    movie_id: Uuid,
    states: Option<Vec<LicensingState>>,
    after: Option<(DateTime<Utc>, Uuid)>,
    limit: u32,
) -> Result<Vec<TrackWithSong>, TrackError> {
    if !repository::movie_exists(pool, movie_id).await? {
        return Err(TrackError::MovieNotFound(movie_id));
    }

    Ok(repository::list_movie_tracks(
        pool,
        movie_id,
        state_names(states),
        after,
        fetch_limit(limit),
    )
    .await?)
}

/// Reads a track's history, oldest first.
pub async fn list_track_history(
    pool: &PgPool,
    track_id: Uuid,
    after_id: Option<i64>,
    limit: u32,
) -> Result<Vec<StoredEvent>, TrackError> {
    // An unknown track is reported as such rather than as an empty history.
    if !repository::track_exists(pool, track_id).await? {
        return Err(TrackError::TrackNotFound(track_id));
    }

    Ok(repository::list_track_events(pool, track_id, after_id, fetch_limit(limit)).await?)
}

fn state_names(states: Option<Vec<LicensingState>>) -> Option<Vec<String>> {
    states.map(|states| {
        states
            .into_iter()
            .map(|state| state.as_str().to_string())
            .collect()
    })
}
