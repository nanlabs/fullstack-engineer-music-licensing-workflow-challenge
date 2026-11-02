use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use iam::auth::extract::Auth;
use kernel::{MovieId, SceneId};

use crate::scene::{CreateSceneRequest, ReorderScenesRequest, UpdateSceneRequest};
use crate::Container;

/// GET /movies/{movie_id}/scenes
pub async fn list_scenes(
    container: web::Data<Container>,
    auth: Auth,
    movie_id: web::Path<MovieId>,
) -> Result<HttpResponse, AppError> {
    let scenes = container.scene_service.list(&auth, movie_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(scenes))
}

/// POST /movies/{movie_id}/scenes
pub async fn create_scene(
    container: web::Data<Container>,
    auth: Auth,
    movie_id: web::Path<MovieId>,
    body: ValidatedJson<CreateSceneRequest>,
) -> Result<HttpResponse, AppError> {
    let scene = container
        .scene_service
        .create(&auth, movie_id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Created().json(scene))
}

/// PUT /movies/{movie_id}/scenes/order
pub async fn reorder_scenes(
    container: web::Data<Container>,
    auth: Auth,
    movie_id: web::Path<MovieId>,
    body: ValidatedJson<ReorderScenesRequest>,
) -> Result<HttpResponse, AppError> {
    let scenes = container
        .scene_service
        .reorder(&auth, movie_id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(scenes))
}

/// GET /scenes/{id}
pub async fn get_scene(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SceneId>,
) -> Result<HttpResponse, AppError> {
    let scene = container.scene_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(scene))
}

/// PUT /scenes/{id}
pub async fn update_scene(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SceneId>,
    body: ValidatedJson<UpdateSceneRequest>,
) -> Result<HttpResponse, AppError> {
    let scene = container
        .scene_service
        .update(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(scene))
}

/// DELETE /scenes/{id}
pub async fn delete_scene(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SceneId>,
) -> Result<HttpResponse, AppError> {
    container.scene_service.delete(&auth, id.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}
