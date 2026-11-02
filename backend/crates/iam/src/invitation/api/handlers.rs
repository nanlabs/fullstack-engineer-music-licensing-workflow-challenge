use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use kernel::{InvitationId, PageQuery};

use crate::auth::extract::Auth;
use crate::invitation::{CreateInvitationRequest, InvitationFilter};
use crate::Container;

/// GET /invitations?status=
pub async fn list_invitations(
    container: web::Data<Container>,
    auth: Auth,
    filter: web::Query<InvitationFilter>,
    page: web::Query<PageQuery>,
) -> Result<HttpResponse, AppError> {
    let invitations = container
        .invitation_service
        .list(&auth, &filter, page.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(invitations))
}

/// POST /invitations
pub async fn create_invitation(
    container: web::Data<Container>,
    auth: Auth,
    body: ValidatedJson<CreateInvitationRequest>,
) -> Result<HttpResponse, AppError> {
    let invitation = container.invitation_service.create(&auth, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(invitation))
}

/// GET /invitations/{id}
pub async fn get_invitation(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<InvitationId>,
) -> Result<HttpResponse, AppError> {
    let invitation = container.invitation_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(invitation))
}

/// POST /invitations/{id}/resend
pub async fn resend_invitation(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<InvitationId>,
) -> Result<HttpResponse, AppError> {
    let invitation = container.invitation_service.resend(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(invitation))
}

/// POST /invitations/{id}/revoke
pub async fn revoke_invitation(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<InvitationId>,
) -> Result<HttpResponse, AppError> {
    let invitation = container.invitation_service.revoke(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(invitation))
}
