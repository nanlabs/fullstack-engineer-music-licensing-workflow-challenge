use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use iam::auth::extract::Auth;
use kernel::{MovieId, SceneId, TrackId};

use crate::track::{CreateTrackRequest, TrackFilter, UpdateTrackRequest};
use crate::Container;

/// GET /scenes/{scene_id}/tracks?state=
pub async fn list_scene_tracks(
    container: web::Data<Container>,
    auth: Auth,
    scene_id: web::Path<SceneId>,
    filter: web::Query<TrackFilter>,
) -> Result<HttpResponse, AppError> {
    let tracks = container
        .track_service
        .list_by_scene(&auth, scene_id.into_inner(), &filter)
        .await?;
    Ok(HttpResponse::Ok().json(tracks))
}

/// POST /scenes/{scene_id}/tracks
pub async fn create_track(
    container: web::Data<Container>,
    auth: Auth,
    scene_id: web::Path<SceneId>,
    body: ValidatedJson<CreateTrackRequest>,
) -> Result<HttpResponse, AppError> {
    let track = container
        .track_service
        .create(&auth, scene_id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Created().json(track))
}

/// GET /movies/{movie_id}/tracks?state=
pub async fn list_movie_tracks(
    container: web::Data<Container>,
    auth: Auth,
    movie_id: web::Path<MovieId>,
    filter: web::Query<TrackFilter>,
) -> Result<HttpResponse, AppError> {
    let tracks = container
        .track_service
        .list_by_movie(&auth, movie_id.into_inner(), &filter)
        .await?;
    Ok(HttpResponse::Ok().json(tracks))
}

/// GET /tracks/{id}
pub async fn get_track(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<TrackId>,
) -> Result<HttpResponse, AppError> {
    let track = container.track_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(track))
}

/// PUT /tracks/{id}
pub async fn update_track(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<TrackId>,
    body: ValidatedJson<UpdateTrackRequest>,
) -> Result<HttpResponse, AppError> {
    let track = container
        .track_service
        .update(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(track))
}

/// DELETE /tracks/{id}
pub async fn delete_track(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<TrackId>,
) -> Result<HttpResponse, AppError> {
    container.track_service.delete(&auth, id.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}
