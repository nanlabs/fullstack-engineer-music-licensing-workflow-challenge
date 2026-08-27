use axum::{
    Json,
    extract::{Path, State},
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect,
    Select, Set,
};
use serde::{Deserialize, Serialize};

use uuid::Uuid;

use crate::entities::sea_orm_active_enums::LicensingStatus;
use crate::entities::{movies, scenes, songs, tracks};

use crate::AppState;
use crate::error::AppError;
use crate::validation::validate_track_times;
use crate::workflow::is_valid_transition;
use sea_orm::FromQueryResult;

use axum::response::sse::{Event, Sse};
use std::convert::Infallible;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Deserialize)]
pub struct CreateTrackPayload {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub start_time_seconds: i32,
    pub end_time_seconds: i32,
}

#[derive(Deserialize)]
pub struct UpdateTrackStatusPayload {
    pub new_status: LicensingStatus,
}

#[derive(Serialize, FromQueryResult)]
pub struct TrackDto {
    pub id: Uuid,
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub start_time_seconds: i32,
    pub end_time_seconds: i32,
    pub status: LicensingStatus,
    pub song_title: String,
    pub song_artist: String,
    pub scene_name: String,
}

// Helpers

fn base_track_query() -> Select<tracks::Entity> {
    tracks::Entity::find()
        .inner_join(scenes::Entity)
        .inner_join(songs::Entity)
        .select_only()
        .column(tracks::Column::Id)
        .column(tracks::Column::SceneId)
        .column(tracks::Column::SongId)
        .column(tracks::Column::StartTimeSeconds)
        .column(tracks::Column::EndTimeSeconds)
        .column(tracks::Column::Status)
        .column_as(songs::Column::Title, "song_title")
        .column_as(songs::Column::Artist, "song_artist")
        .column_as(scenes::Column::Name, "scene_name")
}

async fn get_track_dto(db: &DatabaseConnection, track_id: Uuid) -> Result<TrackDto, AppError> {
    base_track_query()
        .filter(tracks::Column::Id.eq(track_id))
        .into_model::<TrackDto>()
        .one(db)
        .await?
        .ok_or_else(|| AppError::Internal(format!("Track {track_id} vanished after write")))
}

// Endpoints

pub async fn create_track(
    State(state): State<AppState>,
    Json(payload): Json<CreateTrackPayload>,
) -> Result<Json<TrackDto>, AppError> {
    validate_track_times(payload.start_time_seconds, payload.end_time_seconds)?;

    let scene_exists = scenes::Entity::find_by_id(payload.scene_id)
        .one(&state.db)
        .await?
        .is_some();
    if !scene_exists {
        return Err(AppError::NotFound("Scene not found".to_string()));
    }

    let song_exists = songs::Entity::find_by_id(payload.song_id)
        .one(&state.db)
        .await?
        .is_some();
    if !song_exists {
        return Err(AppError::NotFound("Song not found".to_string()));
    }

    let new_track = tracks::ActiveModel {
        scene_id: Set(payload.scene_id),
        song_id: Set(payload.song_id),
        start_time_seconds: Set(payload.start_time_seconds),
        end_time_seconds: Set(payload.end_time_seconds),
        ..Default::default()
    };

    let inserted_track = new_track.insert(&state.db).await?;

    let dto = get_track_dto(&state.db, inserted_track.id).await?;
    Ok(Json(dto))
}

pub async fn get_movie_tracks(
    State(state): State<AppState>,
    Path(movie_id): Path<Uuid>,
) -> Result<Json<Vec<TrackDto>>, AppError> {
    let movie_exists = movies::Entity::find_by_id(movie_id)
        .one(&state.db)
        .await?
        .is_some();
    if !movie_exists {
        return Err(AppError::NotFound("Movie not found".to_string()));
    }

    let tracks = base_track_query()
        .filter(scenes::Column::MovieId.eq(movie_id))
        .into_model::<TrackDto>()
        .all(&state.db)
        .await?;

    Ok(Json(tracks))
}

pub async fn update_track_status(
    State(state): State<AppState>,
    Path(track_id): Path<Uuid>,
    Json(payload): Json<UpdateTrackStatusPayload>,
) -> Result<Json<TrackDto>, AppError> {
    let track = tracks::Entity::find_by_id(track_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Track not found".to_string()))?;

    if !is_valid_transition(&track.status, &payload.new_status) {
        return Err(AppError::InvalidTransition(format!(
            "Invalid transition: Cannot move from {} to {}",
            track.status, payload.new_status
        )));
    }

    let mut active_track: tracks::ActiveModel = track.into();
    active_track.status = Set(payload.new_status.clone());

    let updated_track = active_track.update(&state.db).await?;

    let dto = get_track_dto(&state.db, updated_track.id).await?;

    match serde_json::to_string(&dto) {
        Ok(event_message) => {
            let _ = state.tx.send(event_message);
        }
        Err(err) => tracing::error!("Failed to serialize SSE event for track {track_id}: {err}"),
    }

    Ok(Json(dto))
}

pub async fn sse_handler(
    State(state): State<AppState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let rx = state.tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| match res {
        Ok(msg) => Some(Ok(Event::default().data(msg))),
        Err(_) => None,
    });
    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

pub async fn get_scene_tracks(
    State(state): State<AppState>,
    Path(scene_id): Path<Uuid>,
) -> Result<Json<Vec<TrackDto>>, AppError> {
    let scene_exists = scenes::Entity::find_by_id(scene_id)
        .one(&state.db)
        .await?
        .is_some();
    if !scene_exists {
        return Err(AppError::NotFound("Scene not found".to_string()));
    }

    let tracks = base_track_query()
        .filter(tracks::Column::SceneId.eq(scene_id))
        .into_model::<TrackDto>()
        .all(&state.db)
        .await?;

    Ok(Json(tracks))
}
