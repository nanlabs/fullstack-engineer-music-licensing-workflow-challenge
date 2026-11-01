use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use kernel::{PageQuery, UserId};

use crate::auth::extract::Auth;
use crate::user::SetScopesRequest;
use crate::Container;

/// GET /users
pub async fn list_users(
    container: web::Data<Container>,
    auth: Auth,
    page: web::Query<PageQuery>,
) -> Result<HttpResponse, AppError> {
    let users = container.user_service.list(&auth, page.into_inner()).await?;
    Ok(HttpResponse::Ok().json(users))
}

/// GET /users/{id}
pub async fn get_user(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<UserId>,
) -> Result<HttpResponse, AppError> {
    let user = container.user_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(user))
}

/// POST /users/{id}/suspend
pub async fn suspend_user(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<UserId>,
) -> Result<HttpResponse, AppError> {
    let user = container.user_service.suspend(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(user))
}

/// POST /users/{id}/reinstate
pub async fn reinstate_user(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<UserId>,
) -> Result<HttpResponse, AppError> {
    let user = container.user_service.reinstate(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(user))
}

/// PUT /users/{id}/scopes
pub async fn set_user_scopes(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<UserId>,
    body: ValidatedJson<SetScopesRequest>,
) -> Result<HttpResponse, AppError> {
    let user = container
        .user_service
        .set_scopes(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(user))
}

/// GET /users/{id}/roles
pub async fn get_user_roles(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<UserId>,
) -> Result<HttpResponse, AppError> {
    let roles = container.role_service.user_roles(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(roles))
}
