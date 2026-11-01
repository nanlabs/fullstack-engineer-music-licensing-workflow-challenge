use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use kernel::{RoleId, UserId};

use crate::auth::extract::Auth;
use crate::role::{AssignRoleRequest, CreateRoleRequest, UpdateRoleRequest};
use crate::Container;

/// GET /roles
pub async fn list_roles(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    let roles = container.role_service.list(&auth).await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({ "roles": roles, "count": roles.len() })))
}

/// POST /roles
pub async fn create_role(
    container: web::Data<Container>,
    auth: Auth,
    body: ValidatedJson<CreateRoleRequest>,
) -> Result<HttpResponse, AppError> {
    let role = container.role_service.create(&auth, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(role))
}

/// GET /roles/{id}
pub async fn get_role(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<RoleId>,
) -> Result<HttpResponse, AppError> {
    let role = container.role_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(role))
}

/// PUT /roles/{id}
pub async fn update_role(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<RoleId>,
    body: ValidatedJson<UpdateRoleRequest>,
) -> Result<HttpResponse, AppError> {
    let role = container
        .role_service
        .update(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(role))
}

/// DELETE /roles/{id}
pub async fn delete_role(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<RoleId>,
) -> Result<HttpResponse, AppError> {
    container.role_service.delete(&auth, id.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// POST /roles/{id}/users
pub async fn assign_role(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<RoleId>,
    body: ValidatedJson<AssignRoleRequest>,
) -> Result<HttpResponse, AppError> {
    container
        .role_service
        .assign(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// DELETE /roles/{id}/users/{user_id}
pub async fn unassign_role(
    container: web::Data<Container>,
    auth: Auth,
    path: web::Path<(RoleId, UserId)>,
) -> Result<HttpResponse, AppError> {
    let (role_id, user_id) = path.into_inner();
    container.role_service.unassign(&auth, role_id, user_id).await?;
    Ok(HttpResponse::NoContent().finish())
}
