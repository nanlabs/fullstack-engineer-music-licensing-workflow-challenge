use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use iam::auth::extract::Auth;
use kernel::TrackId;

use crate::license::{LicenseEventKind, TransitionRequest};
use crate::Container;

/// POST /tracks/{id}/license/{event}
///
/// One custom method per transition; the event name is the path segment
/// (`request`, `start_negotiation`, `approve`, `reject`, `reopen`, `expire`)
/// and the body carries the optional note, source, `expires_at` and
/// `expected_state`. Answers with the updated track.
pub async fn transition_license(
    container: web::Data<Container>,
    auth: Auth,
    path: web::Path<(TrackId, LicenseEventKind)>,
    body: ValidatedJson<TransitionRequest>,
) -> Result<HttpResponse, AppError> {
    let (track_id, event) = path.into_inner();
    let track = container
        .license_service
        .transition(&auth, track_id, event, body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(track))
}

/// GET /tracks/{id}/license/events
pub async fn list_license_events(
    container: web::Data<Container>,
    auth: Auth,
    track_id: web::Path<TrackId>,
) -> Result<HttpResponse, AppError> {
    let history = container.license_service.history(&auth, track_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(history))
}
