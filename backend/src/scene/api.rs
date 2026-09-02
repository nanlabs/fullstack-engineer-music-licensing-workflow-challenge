use actix_web::{HttpResponse, web};

use crate::error::AppError;
use crate::iam::auth::AuthContext;
use crate::iam::scopes;
use crate::kernel::SceneId;
use crate::track::{TrackResponse, TrackService};

use super::model::{CreateSceneRequest, SceneResponse, UpdateSceneRequest};
use super::service::SceneService;

// ============================================================================
// Handlers
// ============================================================================

/// Create a scene
#[utoipa::path(
    post,
    path = "/api/scenes",
    tag = "Scenes",
    security(("bearer_auth" = [])),
    request_body = CreateSceneRequest,
    responses(
        (status = 201, description = "Scene created", body = SceneResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Movie not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn create_scene(
    auth: AuthContext,
    svc: web::Data<SceneService>,
    body: web::Json<CreateSceneRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SCENES_WRITE)?;
    let scene = svc.create_scene(body.into_inner(), &auth.user_id).await?;
    Ok(HttpResponse::Created().json(SceneResponse::from(scene)))
}

/// Get a scene
#[utoipa::path(
    get,
    path = "/api/scenes/{id}",
    tag = "Scenes",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Scene id")),
    responses(
        (status = 200, description = "Scene", body = SceneResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Scene not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn get_scene(
    auth: AuthContext,
    svc: web::Data<SceneService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SCENES_READ)?;
    let scene = svc
        .get_scene(&SceneId::from_string(path.into_inner()))
        .await?;
    Ok(HttpResponse::Ok().json(SceneResponse::from(scene)))
}

/// Update a scene
#[utoipa::path(
    put,
    path = "/api/scenes/{id}",
    tag = "Scenes",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Scene id")),
    request_body = UpdateSceneRequest,
    responses(
        (status = 200, description = "Scene updated", body = SceneResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Scene not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn update_scene(
    auth: AuthContext,
    svc: web::Data<SceneService>,
    path: web::Path<String>,
    body: web::Json<UpdateSceneRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SCENES_WRITE)?;
    let scene = svc
        .update_scene(
            &SceneId::from_string(path.into_inner()),
            body.into_inner(),
            &auth.user_id,
        )
        .await?;
    Ok(HttpResponse::Ok().json(SceneResponse::from(scene)))
}

/// Delete a scene
#[utoipa::path(
    delete,
    path = "/api/scenes/{id}",
    tag = "Scenes",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Scene id")),
    responses(
        (status = 204, description = "Scene deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Scene not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn delete_scene(
    auth: AuthContext,
    svc: web::Data<SceneService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SCENES_DELETE)?;
    svc.delete_scene(&SceneId::from_string(path.into_inner()), &auth.user_id)
        .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// List a scene's tracks
#[utoipa::path(
    get,
    path = "/api/scenes/{id}/tracks",
    tag = "Scenes",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Scene id")),
    responses(
        (status = 200, description = "Scene tracks", body = Vec<TrackResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Scene not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_scene_tracks(
    auth: AuthContext,
    svc: web::Data<TrackService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_TRACKS_READ)?;
    let tracks = svc
        .list_by_scene(&SceneId::from_string(path.into_inner()))
        .await?;
    let res: Vec<TrackResponse> = svc
        .to_details(&tracks)
        .await?
        .iter()
        .map(TrackResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/scenes")
            .route("", web::post().to(create_scene))
            .route("/{id}", web::get().to(get_scene))
            .route("/{id}", web::put().to(update_scene))
            .route("/{id}", web::delete().to(delete_scene))
            .route("/{id}/tracks", web::get().to(list_scene_tracks)),
    );
}
