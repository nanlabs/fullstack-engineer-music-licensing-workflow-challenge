use std::convert::Infallible;

use actix_web::http::header::CACHE_CONTROL;
use actix_web::{web, HttpRequest, HttpResponse};
use errx::AppError;
use futures_util::StreamExt;
use iam::auth::extract::Auth;

use crate::Container;

/// GET /events
///
/// Server-Sent Events of the caller's tenant. `Last-Event-ID` (sent by the
/// browser on reconnect) is the position of the last event seen; the events
/// after it are replayed first. The response is `text/event-stream` with
/// caching and proxy buffering disabled; errors (401, 403, 400) are the
/// usual JSON, which also stops `EventSource` from reconnecting in a loop.
pub async fn stream_events(
    container: web::Data<Container>,
    auth: Auth,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let last_event_id = parse_last_event_id(req.headers().get("last-event-id").and_then(|v| v.to_str().ok()))?;
    let stream = container.events_service.open(&auth, last_event_id).await?;
    Ok(HttpResponse::Ok()
        .content_type("text/event-stream; charset=utf-8")
        .insert_header((CACHE_CONTROL, "no-cache"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(stream.map(Ok::<_, Infallible>)))
}

/// Our ids are event positions; anything else is a client error. An absent
/// or empty header means "from now on".
fn parse_last_event_id(raw: Option<&str>) -> Result<Option<i64>, AppError> {
    let Some(raw) = raw.map(str::trim).filter(|v| !v.is_empty()) else {
        return Ok(None);
    };
    raw.parse::<i64>().ok().filter(|v| *v >= 0).map(Some).ok_or_else(|| {
        AppError::validation("Last-Event-ID must be the id of an event").detail("field", "last_event_id")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn last_event_id_is_a_non_negative_integer_or_absent() {
        assert_eq!(parse_last_event_id(None).unwrap(), None);
        assert_eq!(parse_last_event_id(Some("  ")).unwrap(), None);
        assert_eq!(parse_last_event_id(Some(" 42 ")).unwrap(), Some(42));
        assert_eq!(parse_last_event_id(Some("0")).unwrap(), Some(0));
        for bad in ["abc", "-1", "1.5"] {
            let err = parse_last_event_id(Some(bad)).unwrap_err();
            assert_eq!(err.code(), "VALIDATION_ERROR", "{bad}");
            assert_eq!(err.details()["field"], "last_event_id");
        }
    }
}
