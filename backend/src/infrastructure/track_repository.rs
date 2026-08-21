//! Track persistence and the immutable event log.
//!
//! Reads that only inform a decision run outside any transaction. The
//! transaction covers the writes, and always in this order:
//!
//! ```text
//! BEGIN
//! -> insert or update the track row
//! -> insert the immutable event row
//! -> NOTIFY
//! -> commit
//! ```
//!
//! A track change and the event recording it are written together or not at
//! all, so the history can never contradict the track.
//!
//! `NOTIFY` sits inside the transaction on purpose: PostgreSQL delivers a
//! queued notification only when the transaction commits, so no subscriber can
//! ever see a change that was rolled back.

use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::domain::catalog::Song;
use crate::domain::event::NewTrackEvent;
use crate::domain::track::{LicensingState, SceneInterval, Track};

/// A scene, plus the movie it belongs to.
#[derive(Debug, Clone, Copy)]
pub struct SceneContext {
    pub scene_id: Uuid,
    pub movie_id: Uuid,
    pub duration_ms: i32,
}

/// Row shape shared by every track query.
struct TrackRow {
    id: Uuid,
    scene_id: Uuid,
    song_id: Uuid,
    scene_start_ms: i32,
    scene_end_ms: i32,
    licensing_state: String,
    version: i32,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl TrackRow {
    /// Converts a stored row into its domain form.
    ///
    /// An unrecognised licensing state means the database holds a value this
    /// build does not know about — a failed deployment ordering, not a client
    /// error — so it is surfaced as a decode error rather than guessed at.
    fn into_domain(self) -> Result<Track, sqlx::Error> {
        let licensing_state = LicensingState::parse(&self.licensing_state).ok_or_else(|| {
            sqlx::Error::Decode(
                format!(
                    "unknown licensing_state `{}` in database",
                    self.licensing_state
                )
                .into(),
            )
        })?;

        Ok(Track {
            id: self.id,
            scene_id: self.scene_id,
            song_id: self.song_id,
            interval: SceneInterval::from_stored(self.scene_start_ms, self.scene_end_ms),
            licensing_state,
            version: self.version,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

/// Reads a scene and the movie it belongs to.
pub async fn find_scene(
    pool: &PgPool,
    scene_id: Uuid,
) -> Result<Option<SceneContext>, sqlx::Error> {
    let scene = sqlx::query!(
        r#"SELECT id, movie_id, duration_ms
           FROM scenes
           WHERE id = $1"#,
        scene_id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(scene.map(|scene| SceneContext {
        scene_id: scene.id,
        movie_id: scene.movie_id,
        duration_ms: scene.duration_ms,
    }))
}

/// Reads a song summary.
///
/// The summary is returned rather than a bare existence flag because the change
/// notification carries the song title and artist, so this one read serves both
/// the existence check and the notification.
pub async fn find_song(pool: &PgPool, song_id: Uuid) -> Result<Option<Song>, sqlx::Error> {
    let song = sqlx::query_as!(
        Song,
        r#"SELECT id, title, artist_name FROM songs WHERE id = $1"#,
        song_id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(song)
}

/// Inserts a new track. The caller supplies the ID so the event can reference it.
pub async fn insert_track(
    transaction: &mut Transaction<'static, Postgres>,
    id: Uuid,
    scene_id: Uuid,
    song_id: Uuid,
    interval: SceneInterval,
    licensing_state: LicensingState,
) -> Result<Track, sqlx::Error> {
    let row = sqlx::query_as!(
        TrackRow,
        r#"INSERT INTO tracks
               (id, scene_id, song_id, scene_start_ms, scene_end_ms, licensing_state)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, scene_id, song_id, scene_start_ms, scene_end_ms,
                     licensing_state, version, created_at, updated_at"#,
        id,
        scene_id,
        song_id,
        interval.start_ms(),
        interval.end_ms(),
        licensing_state.as_str(),
    )
    .fetch_one(&mut **transaction)
    .await?;

    row.into_domain()
}

/// A track, together with the movie its scene belongs to and the song it
/// currently uses.
///
/// The song travels with it because every write publishes a change
/// notification carrying the full track representation, song summary included.
pub struct TrackContext {
    pub track: Track,
    pub movie_id: Uuid,
    pub song: Song,
}

/// Reads a track with everything a write needs to decide what to do.
///
/// The version read here is what the caller compares against
/// `expected_version`, and what the conditional `UPDATE` re-checks at write
/// time — so a track that moves in between is caught rather than overwritten.
pub async fn find_track_context(
    pool: &PgPool,
    track_id: Uuid,
) -> Result<Option<TrackContext>, sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT t.id, t.scene_id, t.song_id, t.scene_start_ms, t.scene_end_ms,
                  t.licensing_state, t.version, t.created_at, t.updated_at,
                  sc.movie_id,
                  so.title AS song_title, so.artist_name AS song_artist_name
           FROM tracks t
           JOIN scenes sc ON sc.id = t.scene_id
           JOIN songs so ON so.id = t.song_id
           WHERE t.id = $1"#,
        track_id,
    )
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let track = TrackRow {
        id: row.id,
        scene_id: row.scene_id,
        song_id: row.song_id,
        scene_start_ms: row.scene_start_ms,
        scene_end_ms: row.scene_end_ms,
        licensing_state: row.licensing_state,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
    .into_domain()?;

    Ok(Some(TrackContext {
        track,
        movie_id: row.movie_id,
        song: Song {
            id: row.song_id,
            title: row.song_title,
            artist_name: row.song_artist_name,
        },
    }))
}

/// Writes a new licensing state and bumps the version.
///
/// The `version` predicate is the whole of the concurrency control: the write
/// applies only if the track is still on the version the caller decided
/// against. `None` means it is not, and nothing was written.
///
/// `updated_at` is set from `clock_timestamp()` rather than `now()`, which
/// would return the time the transaction began, and rather than a trigger,
/// which would hide the behaviour from this code.
pub async fn update_licensing_state(
    transaction: &mut Transaction<'static, Postgres>,
    track_id: Uuid,
    licensing_state: LicensingState,
    expected_version: i32,
) -> Result<Option<Track>, sqlx::Error> {
    let row = sqlx::query_as!(
        TrackRow,
        r#"UPDATE tracks
           SET licensing_state = $2,
               version = version + 1,
               updated_at = clock_timestamp()
           WHERE id = $1 AND version = $3
           RETURNING id, scene_id, song_id, scene_start_ms, scene_end_ms,
                     licensing_state, version, created_at, updated_at"#,
        track_id,
        licensing_state.as_str(),
        expected_version,
    )
    .fetch_optional(&mut **transaction)
    .await?;

    row.map(TrackRow::into_domain).transpose()
}

/// Applies a revised definition, resetting licensing and bumping the version.
///
/// Guarded by the same `version` predicate as [`update_licensing_state`].
pub async fn update_definition(
    transaction: &mut Transaction<'static, Postgres>,
    track_id: Uuid,
    scene_id: Uuid,
    song_id: Uuid,
    interval: SceneInterval,
    licensing_state: LicensingState,
    expected_version: i32,
) -> Result<Option<Track>, sqlx::Error> {
    let row = sqlx::query_as!(
        TrackRow,
        r#"UPDATE tracks
           SET scene_id = $2,
               song_id = $3,
               scene_start_ms = $4,
               scene_end_ms = $5,
               licensing_state = $6,
               version = version + 1,
               updated_at = clock_timestamp()
           WHERE id = $1 AND version = $7
           RETURNING id, scene_id, song_id, scene_start_ms, scene_end_ms,
                     licensing_state, version, created_at, updated_at"#,
        track_id,
        scene_id,
        song_id,
        interval.start_ms(),
        interval.end_ms(),
        licensing_state.as_str(),
        expected_version,
    )
    .fetch_optional(&mut **transaction)
    .await?;

    row.map(TrackRow::into_domain).transpose()
}

/// Appends an event. Nothing ever updates or deletes these rows.
pub async fn insert_event(
    transaction: &mut Transaction<'static, Postgres>,
    event: &NewTrackEvent,
) -> Result<i64, sqlx::Error> {
    let id = sqlx::query_scalar!(
        r#"INSERT INTO track_events
               (track_id, movie_id, track_version, event_type, payload,
                actor_id, actor_name, previous_scene_id, new_scene_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id"#,
        event.track_id,
        event.movie_id,
        event.track_version,
        event.event_type.as_str(),
        event.payload,
        event.actor.id,
        event.actor.name,
        event.previous_scene_id,
        event.new_scene_id,
    )
    .fetch_one(&mut **transaction)
    .await?;

    Ok(id)
}

/// A track together with the song it uses, as returned by list endpoints.
pub struct TrackWithSong {
    pub track: Track,
    pub song: Song,
}

/// Row shape for the list queries, which join the song summary.
struct TrackWithSongRow {
    id: Uuid,
    scene_id: Uuid,
    song_id: Uuid,
    scene_start_ms: i32,
    scene_end_ms: i32,
    licensing_state: String,
    version: i32,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    song_title: String,
    song_artist_name: String,
}

impl TrackWithSongRow {
    fn into_domain(self) -> Result<TrackWithSong, sqlx::Error> {
        let song = Song {
            id: self.song_id,
            title: self.song_title,
            artist_name: self.song_artist_name,
        };

        let track = TrackRow {
            id: self.id,
            scene_id: self.scene_id,
            song_id: self.song_id,
            scene_start_ms: self.scene_start_ms,
            scene_end_ms: self.scene_end_ms,
            licensing_state: self.licensing_state,
            version: self.version,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
        .into_domain()?;

        Ok(TrackWithSong { track, song })
    }
}

/// Lists the tracks of one scene, ordered by `(created_at, id)`.
pub async fn list_scene_tracks(
    pool: &PgPool,
    scene_id: Uuid,
    states: Option<Vec<String>>,
    after: Option<(chrono::DateTime<chrono::Utc>, Uuid)>,
    limit: i64,
) -> Result<Vec<TrackWithSong>, sqlx::Error> {
    // One statement with optional predicates, rather than four hand-written
    // permutations: `$2::text[] IS NULL` and the tuple comparison both remain
    // index-friendly against tracks(scene_id, created_at, id).
    let rows = sqlx::query_as!(
        TrackWithSongRow,
        r#"SELECT t.id, t.scene_id, t.song_id, t.scene_start_ms, t.scene_end_ms,
                  t.licensing_state, t.version, t.created_at, t.updated_at,
                  s.title AS song_title, s.artist_name AS song_artist_name
           FROM tracks t
           JOIN songs s ON s.id = t.song_id
           WHERE t.scene_id = $1
             AND ($2::text[] IS NULL OR t.licensing_state = ANY($2))
             AND ($3::timestamptz IS NULL OR (t.created_at, t.id) > ($3, $4))
           ORDER BY t.created_at, t.id
           LIMIT $5"#,
        scene_id,
        states.as_deref(),
        after.map(|(created_at, _)| created_at),
        after.map(|(_, id)| id),
        limit,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(TrackWithSongRow::into_domain)
        .collect()
}

/// Lists every track in a movie, across all of its scenes.
pub async fn list_movie_tracks(
    pool: &PgPool,
    movie_id: Uuid,
    states: Option<Vec<String>>,
    after: Option<(chrono::DateTime<chrono::Utc>, Uuid)>,
    limit: i64,
) -> Result<Vec<TrackWithSong>, sqlx::Error> {
    let rows = sqlx::query_as!(
        TrackWithSongRow,
        r#"SELECT t.id, t.scene_id, t.song_id, t.scene_start_ms, t.scene_end_ms,
                  t.licensing_state, t.version, t.created_at, t.updated_at,
                  s.title AS song_title, s.artist_name AS song_artist_name
           FROM tracks t
           JOIN scenes sc ON sc.id = t.scene_id
           JOIN songs s ON s.id = t.song_id
           WHERE sc.movie_id = $1
             AND ($2::text[] IS NULL OR t.licensing_state = ANY($2))
             AND ($3::timestamptz IS NULL OR (t.created_at, t.id) > ($3, $4))
           ORDER BY t.created_at, t.id
           LIMIT $5"#,
        movie_id,
        states.as_deref(),
        after.map(|(created_at, _)| created_at),
        after.map(|(_, id)| id),
        limit,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(TrackWithSongRow::into_domain)
        .collect()
}

/// One recorded event, as history returns it.
pub struct StoredEvent {
    pub id: i64,
    pub track_id: Uuid,
    pub track_version: i32,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub actor_id: Uuid,
    pub actor_name: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub previous_scene_id: Option<Uuid>,
    pub new_scene_id: Option<Uuid>,
}

/// Reads a track's history oldest-first, paginated by event id.
///
/// Ordering by `id` is exact rather than approximate: an event is only written
/// after a version bump the database accepted, and one track's version can only
/// advance one writer at a time, so that track's event ids follow its commit
/// order. Timestamps could tie; ids cannot.
pub async fn list_track_events(
    pool: &PgPool,
    track_id: Uuid,
    after_id: Option<i64>,
    limit: i64,
) -> Result<Vec<StoredEvent>, sqlx::Error> {
    sqlx::query_as!(
        StoredEvent,
        r#"SELECT id, track_id, track_version, event_type, payload,
                  actor_id, actor_name, occurred_at,
                  previous_scene_id, new_scene_id
           FROM track_events
           WHERE track_id = $1
             AND ($2::bigint IS NULL OR id > $2)
           ORDER BY id
           LIMIT $3"#,
        track_id,
        after_id,
        limit,
    )
    .fetch_all(pool)
    .await
}

/// Whether a scene exists, for distinguishing an empty listing from a bad path.
pub async fn scene_exists(pool: &PgPool, scene_id: Uuid) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM scenes WHERE id = $1) AS "exists!""#,
        scene_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Whether a movie exists.
pub async fn movie_exists(pool: &PgPool, movie_id: Uuid) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1) AS "exists!""#,
        movie_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Whether a track exists, for distinguishing "no history" from "no track".
pub async fn track_exists(pool: &PgPool, track_id: Uuid) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM tracks WHERE id = $1) AS "exists!""#,
        track_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Fetches a single track.
pub async fn find_track(pool: &PgPool, track_id: Uuid) -> Result<Option<Track>, sqlx::Error> {
    let row = sqlx::query_as!(
        TrackRow,
        r#"SELECT id, scene_id, song_id, scene_start_ms, scene_end_ms,
                  licensing_state, version, created_at, updated_at
           FROM tracks
           WHERE id = $1"#,
        track_id,
    )
    .fetch_optional(pool)
    .await?;

    row.map(TrackRow::into_domain).transpose()
}
