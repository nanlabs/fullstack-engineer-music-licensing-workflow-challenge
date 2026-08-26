use axum::{
    Json,
    extract::{Path, State},
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect, Set,
};
use serde::{Deserialize, Serialize};

use uuid::Uuid;

use crate::entities::prelude::*;
use crate::entities::sea_orm_active_enums::LicensingStatus;
use crate::entities::{movies, scenes, songs, tracks};

use crate::AppState;
use sea_orm::FromQueryResult;

use axum::response::sse::{Event, Sse};
use std::convert::Infallible;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Deserialize)]
pub struct CreateTrackPayload {
    // Contract that the client will send in JSON format
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
    pub start_time_seconds: i32,
    pub end_time_seconds: i32,
    pub status: LicensingStatus,
    pub song_title: String,
    pub song_artist: String,
    pub scene_name: String,
}

pub async fn create_track(
    State(state): State<AppState>,
    Json(payload): Json<CreateTrackPayload>,
) -> Result<Json<tracks::Model>, String> {
    let new_track = tracks::ActiveModel {
        scene_id: Set(payload.scene_id),
        song_id: Set(payload.song_id),
        start_time_seconds: Set(payload.start_time_seconds),
        end_time_seconds: Set(payload.end_time_seconds),
        ..Default::default()
    };

    let inserted_track = new_track
        .insert(&state.db)
        .await
        .map_err(|e| format!("Error inserting the new track: {}", e))?;

    Ok(Json(inserted_track))
}

pub async fn get_movie_tracks(
    State(state): State<AppState>,
    Path(movie_id): Path<Uuid>,
) -> Result<Json<Vec<TrackDto>>, String> {
    let tracks = tracks::Entity::find()
        .inner_join(scenes::Entity)
        .inner_join(songs::Entity)
        .filter(scenes::Column::MovieId.eq(movie_id))
        .select_only()
        .column(tracks::Column::Id)
        .column(tracks::Column::SceneId)
        .column(tracks::Column::StartTimeSeconds)
        .column(tracks::Column::EndTimeSeconds)
        .column(tracks::Column::Status)
        .column_as(songs::Column::Title, "song_title")
        .column_as(songs::Column::Artist, "song_artist")
        .column_as(scenes::Column::Name, "scene_name")
        .into_model::<TrackDto>()
        .all(&state.db)
        .await
        .map_err(|e| format!("Error fetching tracks: {}", e))?;

    Ok(Json(tracks))
}

pub async fn update_track_status(
    State(state): State<AppState>,
    Path(track_id): Path<Uuid>,
    Json(payload): Json<UpdateTrackStatusPayload>,
) -> Result<Json<tracks::Model>, String> {
    let track = tracks::Entity::find_by_id(track_id)
        .one(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Track not found".to_string())?;
    let is_valid_transition = match (&track.status, &payload.new_status) {
        (LicensingStatus::Draft, LicensingStatus::Negotiating) => true,
        (LicensingStatus::Negotiating, LicensingStatus::Approved) => true,
        (LicensingStatus::Negotiating, LicensingStatus::Rejected) => true,
        (LicensingStatus::Rejected, LicensingStatus::Negotiating) => true,
        _ => false,
    };
    if !is_valid_transition {
        return Err(format!(
            "Invalid transition: Cannot move from {:?} to {:?}",
            track.status, payload.new_status
        ));
    }
    let mut active_track: tracks::ActiveModel = track.into();
    active_track.status = Set(payload.new_status.clone());

    let updated_track = active_track
        .update(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let event_message = format!(
        r#"{{"track_id": "{}", "new_status": "{:?}"}}"#,
        track_id, payload.new_status
    );

    let _ = state.tx.send(event_message);
    Ok(Json(updated_track))
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
) -> Result<Json<Vec<TrackDto>>, String> {
    let tracks = tracks::Entity::find()
        .inner_join(scenes::Entity)
        .inner_join(songs::Entity)
        .filter(tracks::Column::SceneId.eq(scene_id))
        .select_only()
        .column(tracks::Column::Id)
        .column(tracks::Column::SceneId)
        .column(tracks::Column::StartTimeSeconds)
        .column(tracks::Column::EndTimeSeconds)
        .column(tracks::Column::Status)
        .column_as(songs::Column::Title, "song_title")
        .column_as(songs::Column::Artist, "song_artist")
        .column_as(scenes::Column::Name, "scene_name")
        .into_model::<TrackDto>()
        .all(&state.db)
        .await
        .map_err(|e| format!("Error fetching scene tracks: {}", e))?;

    Ok(Json(tracks))
}
