use actix_web::{HttpResponse, web};

use crate::error::AppError;
use crate::iam::auth::AuthContext;
use crate::iam::scopes;
use crate::kernel::{LabelId, UserId};
use crate::song::{SongResponse, SongService};

use super::model::{
    AddMemberRequest, CreateLabelRequest, LabelMemberResponse, LabelResponse, UpdateLabelRequest,
};
use super::service::LabelService;

// ============================================================================
// Handlers
// ============================================================================

/// Create a label
#[utoipa::path(
    post,
    path = "/api/labels",
    tag = "Labels",
    security(("bearer_auth" = [])),
    request_body = CreateLabelRequest,
    responses(
        (status = 201, description = "Label created", body = LabelResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn create_label(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    body: web::Json<CreateLabelRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_WRITE)?;
    let label = svc.create_label(body.into_inner()).await?;
    Ok(HttpResponse::Created().json(LabelResponse::from(&label)))
}

/// List labels
#[utoipa::path(
    get,
    path = "/api/labels",
    tag = "Labels",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "All labels", body = Vec<LabelResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_labels(
    auth: AuthContext,
    svc: web::Data<LabelService>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_READ)?;
    let labels = svc.list_labels().await?;
    let res: Vec<LabelResponse> = labels.iter().map(LabelResponse::from).collect();
    Ok(HttpResponse::Ok().json(res))
}

/// Get a label
#[utoipa::path(
    get,
    path = "/api/labels/{id}",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    responses(
        (status = 200, description = "Label", body = LabelResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn get_label(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_READ)?;
    let label = svc
        .get_label(&LabelId::from_string(path.into_inner()))
        .await?;
    Ok(HttpResponse::Ok().json(LabelResponse::from(&label)))
}

/// Update a label
#[utoipa::path(
    put,
    path = "/api/labels/{id}",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    request_body = UpdateLabelRequest,
    responses(
        (status = 200, description = "Label updated", body = LabelResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn update_label(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
    body: web::Json<UpdateLabelRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_WRITE)?;
    let label = svc
        .update_label(&LabelId::from_string(path.into_inner()), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(LabelResponse::from(&label)))
}

/// Delete a label
#[utoipa::path(
    delete,
    path = "/api/labels/{id}",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    responses(
        (status = 204, description = "Label deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn delete_label(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_DELETE)?;
    svc.delete_label(&LabelId::from_string(path.into_inner()))
        .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Add a member to a label
#[utoipa::path(
    post,
    path = "/api/labels/{id}/members",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added", body = LabelMemberResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
        (status = 409, description = "User is already a member", body = crate::error::ErrorResponse),
    )
)]
pub async fn add_member(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
    body: web::Json<AddMemberRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_MEMBERS)?;
    let member = svc
        .add_member(&LabelId::from_string(path.into_inner()), body.into_inner())
        .await?;
    let detail = svc
        .to_member_details(std::slice::from_ref(&member))
        .await?
        .remove(0);
    let res = LabelMemberResponse::from(&detail);
    Ok(HttpResponse::Created().json(res))
}

/// Remove a member from a label
#[utoipa::path(
    delete,
    path = "/api/labels/{id}/members/{user_id}",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Label id"),
        ("user_id" = String, Path, description = "User id to remove"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label or member not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn remove_member(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_MEMBERS)?;
    let (label_id, user_id) = path.into_inner();
    svc.remove_member(
        &LabelId::from_string(label_id),
        &UserId::from_string(user_id),
    )
    .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// List members of a label
#[utoipa::path(
    get,
    path = "/api/labels/{id}/members",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    responses(
        (status = 200, description = "Label members", body = Vec<LabelMemberResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_members(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_READ)?;
    let members = svc
        .list_members(&LabelId::from_string(path.into_inner()))
        .await?;
    let res: Vec<LabelMemberResponse> = svc
        .to_member_details(&members)
        .await?
        .iter()
        .map(LabelMemberResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

/// List labels a user belongs to
#[utoipa::path(
    get,
    path = "/api/users/{id}/labels",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "User id")),
    responses(
        (status = 200, description = "Labels the user belongs to", body = Vec<LabelResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn get_user_labels(
    auth: AuthContext,
    svc: web::Data<LabelService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LABELS_READ)?;
    let labels = svc
        .get_user_labels(&UserId::from_string(path.into_inner()))
        .await?;
    let res: Vec<LabelResponse> = labels.iter().map(LabelResponse::from).collect();
    Ok(HttpResponse::Ok().json(res))
}

/// List a label's songs
#[utoipa::path(
    get,
    path = "/api/labels/{id}/songs",
    tag = "Labels",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Label id")),
    responses(
        (status = 200, description = "Songs owned by this label", body = Vec<SongResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Label not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_label_songs(
    auth: AuthContext,
    svc: web::Data<SongService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_READ)?;
    let songs = svc
        .list_by_label(&LabelId::from_string(path.into_inner()))
        .await?;
    let res: Vec<SongResponse> = svc
        .to_details(&songs)
        .await?
        .iter()
        .map(SongResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/labels")
            .route("", web::post().to(create_label))
            .route("", web::get().to(list_labels))
            .route("/{id}", web::get().to(get_label))
            .route("/{id}", web::put().to(update_label))
            .route("/{id}", web::delete().to(delete_label))
            .route("/{id}/members", web::post().to(add_member))
            .route("/{id}/members", web::get().to(list_members))
            .route("/{id}/members/{user_id}", web::delete().to(remove_member))
            .route("/{id}/songs", web::get().to(list_label_songs)),
    );
    cfg.route("/users/{id}/labels", web::get().to(get_user_labels));
}
