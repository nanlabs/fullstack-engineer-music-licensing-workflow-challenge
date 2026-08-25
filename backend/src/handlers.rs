use axum::{Json, extract::State};
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::tracks;

#[derive(Deserialize)]
pub struct CreateTrackPayload {
    // Contract that the client will send in JSON format
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub start_time_seconds: i32,
    pub end_time_seconds: i32,
}

pub async fn create_track(
    State(db): State<DatabaseConnection>,
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
        .insert(&db)
        .await
        .map_err(|e| format!("Error inserting the new track: {}", e))?;

    Ok(Json(inserted_track))
}
