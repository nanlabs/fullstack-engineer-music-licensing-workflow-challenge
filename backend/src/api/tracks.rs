//! Track endpoints.
//!
//! The two mutating endpoints use `PUT` with the precondition carried in the
//! body rather than `PATCH` with `If-Match`. That decision, its costs, and the
//! retry guarantees it buys are recorded in
//! `docs/adr/0001-put-for-track-mutations.md`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::auth::AuthenticatedActor;
use crate::api::error::{ApiError, ProblemCode};
use crate::api::pagination::{Page, PageQuery};
use crate::api::AppState;
use crate::application::tracks::{self, NewTrack, TrackRevision};
use crate::domain::track::{LicensingState, Track};
use crate::infrastructure::track_repository::{StoredEvent, TrackWithSong};

/// The representation returned by every track endpoint.
///
/// `duration_ms` is derived rather than stored, and `version` is exposed
/// because clients need it for the optimistic-concurrency preconditions that
/// the update endpoints will require.
#[derive(Debug, Serialize)]
pub struct TrackDto {
    pub id: Uuid,
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
    pub duration_ms: i32,
    pub licensing_state: &'static str,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Track> for TrackDto {
    fn from(track: Track) -> Self {
        Self {
            id: track.id,
            scene_id: track.scene_id,
            song_id: track.song_id,
            scene_start_ms: track.interval.start_ms(),
            scene_end_ms: track.interval.end_ms(),
            duration_ms: track.interval.duration_ms(),
            licensing_state: track.licensing_state.as_str(),
            version: track.version,
            created_at: track.created_at,
            updated_at: track.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTrackRequest {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
}

/// `POST /tracks` — places a song in a scene.
///
/// This endpoint has no request-level idempotency key: retrying after an
/// ambiguous failure may create a second track. That is deliberate, because
/// duplicate tracks are legitimate and cannot be told apart from a retry by
/// their fields alone.
pub async fn create_track(
    State(state): State<AppState>,
    AuthenticatedActor(actor): AuthenticatedActor,
    Json(request): Json<CreateTrackRequest>,
) -> Result<(StatusCode, Json<TrackDto>), ApiError> {
    let track = tracks::create_track(
        &state.pool,
        &actor,
        NewTrack {
            scene_id: request.scene_id,
            song_id: request.song_id,
            scene_start_ms: request.scene_start_ms,
            scene_end_ms: request.scene_end_ms,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(track.into())))
}

/// A track plus the song it uses, as returned by list endpoints.
///
/// The song summary is embedded so a client rendering a scene's tracks does not
/// have to fetch and join the song catalogue itself.
#[derive(Debug, Serialize)]
pub struct TrackWithSongDto {
    #[serde(flatten)]
    pub track: TrackDto,
    pub song: SongSummaryDto,
}

#[derive(Debug, Serialize)]
pub struct SongSummaryDto {
    pub id: Uuid,
    pub title: String,
    pub artist_name: String,
}

impl From<TrackWithSong> for TrackWithSongDto {
    fn from(row: TrackWithSong) -> Self {
        Self {
            track: row.track.into(),
            song: SongSummaryDto {
                id: row.song.id,
                title: row.song.title,
                artist_name: row.song.artist_name,
            },
        }
    }
}

/// A complete desired definition for an existing track.
#[derive(Debug, Deserialize)]
pub struct ReviseTrackRequest {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
    pub expected_version: i32,
}

/// `PUT /tracks/{track_id}` — sets the track's complete definition.
///
/// Any material change resets licensing to `Pending`, **including from
/// `Licensed`, `Rejected`, or `Cancelled`**. Permission was granted for a
/// specific use; a revised track is a different use and needs its own
/// permission. Revising a cancelled track revives it. The previous outcome
/// stays visible in the track's history.
pub async fn revise_track(
    State(state): State<AppState>,
    AuthenticatedActor(actor): AuthenticatedActor,
    Path(track_id): Path<Uuid>,
    Json(request): Json<ReviseTrackRequest>,
) -> Result<Json<TrackDto>, ApiError> {
    let track = tracks::revise_track(
        &state.pool,
        &actor,
        track_id,
        TrackRevision {
            scene_id: request.scene_id,
            song_id: request.song_id,
            scene_start_ms: request.scene_start_ms,
            scene_end_ms: request.scene_end_ms,
        },
        request.expected_version,
    )
    .await?;

    Ok(Json(track.into()))
}

/// Query parameters accepted by the track collections.
#[derive(Debug, Deserialize)]
pub struct TrackListQuery {
    pub limit: Option<u32>,
    pub cursor: Option<String>,
    /// Comma-separated licensing states. Absent means every state, cancelled
    /// tracks included.
    pub licensing_state: Option<String>,
}

impl TrackListQuery {
    fn page(&self) -> PageQuery {
        PageQuery {
            limit: self.limit,
            cursor: self.cursor.clone(),
        }
    }

    /// Parses the state filter, rejecting unknown names rather than silently
    /// dropping them, which would return a page that quietly means something
    /// else than the client asked for.
    fn states(&self) -> Result<Option<Vec<LicensingState>>, ApiError> {
        let Some(raw) = self.licensing_state.as_deref() else {
            return Ok(None);
        };

        let mut states = Vec::new();
        for name in raw.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            let state = LicensingState::parse(name).ok_or_else(|| {
                ApiError::new(
                    ProblemCode::ValidationFailed,
                    format!(
                        "`{name}` is not a licensing state. Expected one of: {}.",
                        LICENSING_STATE_NAMES.join(", ")
                    ),
                )
            })?;
            states.push(state);
        }

        if states.is_empty() {
            return Err(ApiError::new(
                ProblemCode::ValidationFailed,
                "`licensing_state` must name at least one state.",
            ));
        }

        Ok(Some(states))
    }
}

/// Sort key for both track collections: creation order.
#[derive(Debug, Serialize, Deserialize)]
struct TrackCursor {
    created_at: DateTime<Utc>,
    id: Uuid,
}

fn track_page(rows: Vec<TrackWithSong>, limit: u32) -> Page<TrackWithSongDto> {
    Page::from_lookahead(
        rows.into_iter().map(TrackWithSongDto::from).collect(),
        limit,
        |row| TrackCursor {
            created_at: row.track.created_at,
            id: row.track.id,
        },
    )
}

/// `GET /scenes/{scene_id}/tracks`.
pub async fn list_scene_tracks(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(scene_id): Path<Uuid>,
    Query(query): Query<TrackListQuery>,
) -> Result<Json<Page<TrackWithSongDto>>, ApiError> {
    let page = query.page();
    let limit = page.limit()?;
    let after = page
        .key::<TrackCursor>()?
        .map(|cursor| (cursor.created_at, cursor.id));

    let rows =
        tracks::list_scene_tracks(&state.pool, scene_id, query.states()?, after, limit).await?;

    Ok(Json(track_page(rows, limit)))
}

/// `GET /movies/{movie_id}/tracks` — every track in the movie, across scenes.
pub async fn list_movie_tracks(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(movie_id): Path<Uuid>,
    Query(query): Query<TrackListQuery>,
) -> Result<Json<Page<TrackWithSongDto>>, ApiError> {
    let page = query.page();
    let limit = page.limit()?;
    let after = page
        .key::<TrackCursor>()?
        .map(|cursor| (cursor.created_at, cursor.id));

    let rows =
        tracks::list_movie_tracks(&state.pool, movie_id, query.states()?, after, limit).await?;

    Ok(Json(track_page(rows, limit)))
}

/// One entry of a track's history.
#[derive(Debug, Serialize)]
pub struct TrackEventDto {
    pub id: i64,
    pub track_id: Uuid,
    pub track_version: i32,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub actor_id: Uuid,
    pub actor_name: String,
    pub occurred_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_scene_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_scene_id: Option<Uuid>,
}

impl From<StoredEvent> for TrackEventDto {
    fn from(event: StoredEvent) -> Self {
        Self {
            id: event.id,
            track_id: event.track_id,
            track_version: event.track_version,
            event_type: event.event_type,
            payload: event.payload,
            actor_id: event.actor_id,
            actor_name: event.actor_name,
            occurred_at: event.occurred_at,
            previous_scene_id: event.previous_scene_id,
            new_scene_id: event.new_scene_id,
        }
    }
}

/// `GET /tracks/{track_id}/history` — the immutable audit trail, oldest first.
///
/// Paginated by event id rather than timestamp: ids are unique and follow this
/// track's commit order, while timestamps can tie.
pub async fn list_track_history(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(track_id): Path<Uuid>,
    Query(page): Query<PageQuery>,
) -> Result<Json<Page<TrackEventDto>>, ApiError> {
    let limit = page.limit()?;
    let after_id = page.key::<HistoryCursor>()?.map(|cursor| cursor.event_id);

    let events = tracks::list_track_history(&state.pool, track_id, after_id, limit).await?;

    Ok(Json(Page::from_lookahead(
        events.into_iter().map(TrackEventDto::from).collect(),
        limit,
        |event| HistoryCursor { event_id: event.id },
    )))
}

#[derive(Debug, Serialize, Deserialize)]
struct HistoryCursor {
    event_id: i64,
}

/// The desired licensing state, plus the version it was decided against.
///
/// The precondition travels in the body rather than an `If-Match` header
/// because it belongs beside the intent it qualifies: the server evaluates
/// "make it `licensed`, and I believed it was at version 3" as one statement.
/// The resource already exposes an integer version, so entity tags would add
/// ceremony without adding meaning.
#[derive(Debug, Deserialize)]
pub struct SetLicensingStateRequest {
    pub licensing_state: String,
    pub expected_version: i32,
}

/// `PUT /tracks/{track_id}/licensing-state` — sets the complete desired state.
///
/// `PUT` rather than `PATCH`: the body is the whole desired state of one
/// concern, and repeating the request leaves the server in the same place it
/// left it the first time. Repeating a *successful* request is a no-op — no
/// second version bump, no second event.
pub async fn set_licensing_state(
    State(state): State<AppState>,
    AuthenticatedActor(actor): AuthenticatedActor,
    Path(track_id): Path<Uuid>,
    Json(request): Json<SetLicensingStateRequest>,
) -> Result<Json<TrackDto>, ApiError> {
    let desired = LicensingState::parse(&request.licensing_state).ok_or_else(|| {
        ApiError::new(
            ProblemCode::ValidationFailed,
            format!(
                "`{}` is not a licensing state. Expected one of: {}.",
                request.licensing_state,
                LICENSING_STATE_NAMES.join(", ")
            ),
        )
    })?;

    let track = tracks::set_licensing_state(
        &state.pool,
        &actor,
        track_id,
        desired,
        request.expected_version,
    )
    .await?;

    Ok(Json(track.into()))
}

/// Every accepted spelling, for error messages.
const LICENSING_STATE_NAMES: [&str; 5] = [
    "pending",
    "in_negotiation",
    "licensed",
    "rejected",
    "cancelled",
];

/// `GET /tracks/{track_id}`.
pub async fn get_track(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(track_id): Path<Uuid>,
) -> Result<Json<TrackDto>, ApiError> {
    let track = tracks::find_track(&state.pool, track_id).await?;

    Ok(Json(track.into()))
}
