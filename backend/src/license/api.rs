use actix_web::{HttpResponse, web};
use serde::Deserialize;
use tokio::sync::broadcast;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::iam::auth::AuthContext;
use crate::iam::scopes;
use crate::kernel::LicenseRequestId;

use super::model::{
    CreateLicenseRequest, LicenseEvent, LicenseOfferResponse, LicenseRequestResponse, OfferTerms,
};
use super::service::LicenseService;

// ============================================================================
// Request bodies
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct RejectBody {
    reason: String,
}

#[derive(Debug, serde::Serialize, ToSchema)]
struct CreateLicenseResponseBody {
    license: LicenseRequestResponse,
    offer: LicenseOfferResponse,
}

// ============================================================================
// Handlers
// ============================================================================

/// Create a license request
///
/// Creates a new license request (in `DRAFT` status) for a track, along with
/// its initial offer terms. The request must be submitted separately before
/// the rights holder can see it.
#[utoipa::path(
    post,
    path = "/api/licenses",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    request_body = CreateLicenseRequest,
    responses(
        (status = 201, description = "License request created", body = CreateLicenseResponseBody),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Track not found", body = crate::error::ErrorResponse),
        (status = 409, description = "A license request already exists for this track", body = crate::error::ErrorResponse),
    )
)]
pub async fn create_license(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    body: web::Json<CreateLicenseRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_WRITE)?;
    let (license, offer) = svc.create_license(body.into_inner(), auth.user_id).await?;
    let license = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    let offer = LicenseOfferResponse::from(&svc.to_offer_detail(offer).await?);
    Ok(HttpResponse::Created().json(serde_json::json!({
        "license": license,
        "offer": offer,
    })))
}

/// Get a license request
#[utoipa::path(
    get,
    path = "/api/licenses/{id}",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 200, description = "License request", body = LicenseRequestResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn get_license(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_READ)?;
    let license = svc
        .get_license(&LicenseRequestId::from_string(path.into_inner()))
        .await?;
    let res = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// List offers for a license request
///
/// Returns the full negotiation history, ordered by offer number.
#[utoipa::path(
    get,
    path = "/api/licenses/{id}/offers",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 200, description = "Offer history", body = Vec<LicenseOfferResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_offers(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_READ)?;
    let offers = svc
        .list_offers(&LicenseRequestId::from_string(path.into_inner()))
        .await?;
    let res: Vec<LicenseOfferResponse> = svc
        .to_offer_details(offers)
        .await?
        .iter()
        .map(LicenseOfferResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

/// Revise a draft's terms
///
/// Only available while the request is still in `DRAFT` status.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/revise",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    request_body = OfferTerms,
    responses(
        (status = 200, description = "Draft offer updated", body = LicenseOfferResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "License request is not a draft", body = crate::error::ErrorResponse),
    )
)]
pub async fn revise_draft(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
    body: web::Json<OfferTerms>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_WRITE)?;
    let offer = svc
        .revise_draft(
            &LicenseRequestId::from_string(path.into_inner()),
            body.into_inner(),
            auth.user_id,
        )
        .await?;
    let res = LicenseOfferResponse::from(&svc.to_offer_detail(offer).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Submit a draft license request
///
/// Moves the request from `DRAFT` to `REQUESTED`, making it visible to the
/// rights holder and emitting a `submitted` SSE event.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/submit",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 200, description = "License request submitted", body = LicenseRequestResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "License request is not a draft", body = crate::error::ErrorResponse),
    )
)]
pub async fn submit(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_WRITE)?;
    let license = svc
        .submit(
            &LicenseRequestId::from_string(path.into_inner()),
            auth.user_id,
        )
        .await?;
    let res = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Counter the latest offer
///
/// Only the side that does not own the latest offer may counter it. Emits a
/// `counter_offer` SSE event.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/counter",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    request_body = OfferTerms,
    responses(
        (status = 200, description = "Counter-offer created", body = LicenseOfferResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "Cannot counter own offer or license is not negotiable", body = crate::error::ErrorResponse),
    )
)]
pub async fn counter_offer(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
    body: web::Json<OfferTerms>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_NEGOTIATE)?;
    let offer = svc
        .counter_offer(
            &LicenseRequestId::from_string(path.into_inner()),
            body.into_inner(),
            auth.user_id,
        )
        .await?;
    let res = LicenseOfferResponse::from(&svc.to_offer_detail(offer).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Accept the latest offer
///
/// Resolves the negotiation as `APPROVED`. Emits an `accepted` SSE event.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/accept",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 200, description = "License request approved", body = LicenseRequestResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "License request cannot be accepted in its current state", body = crate::error::ErrorResponse),
    )
)]
pub async fn accept(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_NEGOTIATE)?;
    let license = svc
        .accept(
            &LicenseRequestId::from_string(path.into_inner()),
            auth.user_id,
        )
        .await?;
    let res = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Reject the latest offer
///
/// Resolves the negotiation as `REJECTED`. Emits a `rejected` SSE event.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/reject",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    request_body = RejectBody,
    responses(
        (status = 200, description = "License request rejected", body = LicenseRequestResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "License request cannot be rejected in its current state", body = crate::error::ErrorResponse),
    )
)]
pub async fn reject(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
    body: web::Json<RejectBody>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_NEGOTIATE)?;
    let license = svc
        .reject(
            &LicenseRequestId::from_string(path.into_inner()),
            auth.user_id,
            body.into_inner().reason,
        )
        .await?;
    let res = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Cancel a license request
///
/// Withdraws the request. Only the movie team may cancel. Emits a
/// `cancelled` SSE event.
#[utoipa::path(
    post,
    path = "/api/licenses/{id}/cancel",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 200, description = "License request cancelled", body = LicenseRequestResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "License request cannot be cancelled in its current state", body = crate::error::ErrorResponse),
    )
)]
pub async fn cancel(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_WRITE)?;
    let license = svc
        .cancel(
            &LicenseRequestId::from_string(path.into_inner()),
            auth.user_id,
        )
        .await?;
    let res = LicenseRequestResponse::from(&svc.to_detail(license).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Delete a draft license request
///
/// Only drafts may be deleted; submitted requests must be cancelled instead.
#[utoipa::path(
    delete,
    path = "/api/licenses/{id}",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "License request id")),
    responses(
        (status = 204, description = "License request deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "License request not found", body = crate::error::ErrorResponse),
        (status = 422, description = "Only drafts can be deleted", body = crate::error::ErrorResponse),
    )
)]
pub async fn delete_license(
    auth: AuthContext,
    svc: web::Data<LicenseService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_LICENSES_DELETE)?;
    svc.delete_license(
        &LicenseRequestId::from_string(path.into_inner()),
        auth.user_id,
    )
    .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Stream negotiation events (SSE)
///
/// Streams license negotiation events (submitted / counter-offer / accepted
/// / rejected / cancelled) as `text/event-stream`. The client should call
/// the REST API to fetch full details when an event arrives.
#[utoipa::path(
    get,
    path = "/api/licenses/events",
    tag = "Licenses",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "SSE stream of LicenseEvent objects", body = LicenseEvent, content_type = "text/event-stream"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn events(_auth: AuthContext, svc: web::Data<LicenseService>) -> HttpResponse {
    let mut rx: broadcast::Receiver<LicenseEvent> = svc.subscribe();

    let stream = async_stream::stream! {
        let mut heartbeat = tokio::time::interval(std::time::Duration::from_secs(30));
        // First tick fires immediately — skip it so the client doesn't get
        // a keepalive before any real data.
        heartbeat.tick().await;

        loop {
            tokio::select! {
                result = rx.recv() => {
                    match result {
                        Ok(event) => {
                            if let Ok(json) = serde_json::to_string(&event) {
                                yield Ok::<_, actix_web::Error>(
                                    web::Bytes::from(format!("data: {json}\n\n"))
                                );
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            log::warn!("SSE receiver lagged, dropped {n} messages");
                            // Continue — next recv() returns the oldest retained message
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
                _ = heartbeat.tick() => {
                    yield Ok::<_, actix_web::Error>(
                        web::Bytes::from(": keepalive\n\n")
                    );
                }
            }
        }
    };

    HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        // Prevent the global Compress middleware from buffering this stream:
        // gzip/brotli encoders hold data until their internal buffer fills,
        // which defeats SSE's low-latency delivery. Browsers always send
        // Accept-Encoding, so without this the stream never flushes live.
        .insert_header(("Content-Encoding", "identity"))
        .streaming(stream)
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/licenses")
            .route("/events", web::get().to(events))
            .route("", web::post().to(create_license))
            .route("/{id}", web::get().to(get_license))
            .route("/{id}", web::delete().to(delete_license))
            .route("/{id}/offers", web::get().to(list_offers))
            .route("/{id}/revise", web::post().to(revise_draft))
            .route("/{id}/submit", web::post().to(submit))
            .route("/{id}/counter", web::post().to(counter_offer))
            .route("/{id}/accept", web::post().to(accept))
            .route("/{id}/reject", web::post().to(reject))
            .route("/{id}/cancel", web::post().to(cancel)),
    );
}
