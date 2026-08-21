//! Track endpoints.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::auth::AuthenticatedActor;
use crate::api::error::{ApiError, ProblemCode};
use crate::api::AppState;
use crate::application::tracks::{self, NewTrack};
use crate::domain::track::{LicensingState, Track};

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
