//! Scoped Server-Sent Events streams of track changes.
//!
//! ```text
//! GET /movies/{movie_id}/track-events
//! GET /scenes/{scene_id}/track-events
//! ```
//!
//! # What a stream promises
//!
//! While a client is connected, it receives every track change in its scope in
//! near real time, each carrying the complete current track representation —
//! the same shape the REST endpoints return, so a streamed track can be applied
//! wherever a fetched one would be.
//!
//! # What it does not promise
//!
//! No priming event, no snapshot, no cursor, no replay, and no recovery of
//! anything missed while disconnected. A client loads current state through
//! REST and then subscribes for what happens next. When delivery degrades the
//! stream **closes** rather than skipping events silently, so a client can tell
//! that it has fallen out of touch instead of quietly rendering stale data.
//!
//! # Authentication
//!
//! These routes require a bearer token like every other protected route, which
//! rules out the browser's native `EventSource` — it cannot set an
//! `Authorization` header. A fetch-based SSE client is required. Passing the
//! token in the query string was rejected: URLs land in access logs, proxy
//! logs, and browser history, and a bearer token is a credential.

use std::convert::Infallible;

use axum::extract::{Path, State};
use axum::response::sse::{Event, Sse};
use futures::Stream;
use tokio::sync::broadcast::error::RecvError;
use tokio::sync::{broadcast, watch, OwnedSemaphorePermit};
use tokio::time::{Instant, MissedTickBehavior};
use uuid::Uuid;

use crate::api::auth::AuthenticatedActor;
use crate::api::error::{ApiError, ProblemCode};
use crate::api::AppState;
use crate::infrastructure::event_listener::{ListenerStatus, StreamSignal};
use crate::infrastructure::track_repository;

/// Which changes a stream forwards.
#[derive(Debug, Clone, Copy)]
enum Scope {
    Movie(Uuid),
    /// A relocation reaches both the scene the track left and the one it
    /// arrived in, because both scenes' views of the world changed.
    Scene(Uuid),
}

impl Scope {
    fn matches(
        self,
        notification: &crate::infrastructure::notifications::TrackChangeNotification,
    ) -> bool {
        match self {
            Self::Movie(movie_id) => notification.concerns_movie(movie_id),
            Self::Scene(scene_id) => notification.concerns_scene(scene_id),
        }
    }

    /// Log field, so a degraded close names the scope it affected.
    fn describe(self) -> (&'static str, Uuid) {
        match self {
            Self::Movie(id) => ("movie", id),
            Self::Scene(id) => ("scene", id),
        }
    }
}

/// `GET /movies/{movie_id}/track-events` — every change to any track in the
/// movie, across all of its scenes.
#[utoipa::path(
    get,
    path = "/movies/{movie_id}/track-events",
    tag = "Event streams",
    params(("movie_id" = Uuid, Path, description = "Movie identifier")),
    responses(
        (status = 200, description = "Live stream of complete track change notifications", body = crate::infrastructure::notifications::TrackChangeNotification, content_type = "text/event-stream"),
        (status = 401, description = "Missing or invalid bearer token", body = crate::api::error::ProblemBody),
        (status = 404, description = "Movie not found", body = crate::api::error::ProblemBody),
        (status = 503, description = "Listener unavailable or connection cap reached", body = crate::api::error::ProblemBody)
    )
)]
pub async fn stream_movie_events(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(movie_id): Path<Uuid>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    // An unknown movie is reported as such rather than as a stream that will
    // never emit anything, matching how the movie's REST collections behave.
    if !track_repository::movie_exists(&state.pool, movie_id).await? {
        return Err(ApiError::not_found(format!(
            "Movie `{movie_id}` does not exist."
        )));
    }

    open(&state, Scope::Movie(movie_id))
}

/// `GET /scenes/{scene_id}/track-events` — changes to the tracks of one scene,
/// including tracks moving into or out of it.
#[utoipa::path(
    get,
    path = "/scenes/{scene_id}/track-events",
    tag = "Event streams",
    params(("scene_id" = Uuid, Path, description = "Scene identifier")),
    responses(
        (status = 200, description = "Live stream of complete track change notifications", body = crate::infrastructure::notifications::TrackChangeNotification, content_type = "text/event-stream"),
        (status = 401, description = "Missing or invalid bearer token", body = crate::api::error::ProblemBody),
        (status = 404, description = "Scene not found", body = crate::api::error::ProblemBody),
        (status = 503, description = "Listener unavailable or connection cap reached", body = crate::api::error::ProblemBody)
    )
)]
pub async fn stream_scene_events(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(scene_id): Path<Uuid>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    if !track_repository::scene_exists(&state.pool, scene_id).await? {
        return Err(ApiError::not_found(format!(
            "Scene `{scene_id}` does not exist."
        )));
    }

    open(&state, Scope::Scene(scene_id))
}

/// Subscribes to the process-wide fan-out and builds the response stream.
///
/// Nothing here reads the database: notifications arrive complete, so a burst
/// of writes costs one query on the write path rather than one per connected
/// client.
fn open(
    state: &AppState,
    scope: Scope,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    // Opening a stream while the listener is down would hand the client a
    // connection that silently delivers nothing.
    if state.events.listener_status() != ListenerStatus::Connected {
        return Err(ApiError::new(
            ProblemCode::SseTemporarilyUnavailable,
            "Live updates are reconnecting. Retry shortly; REST remains available.",
        )
        .retryable_in(2));
    }

    let permit = state.events.try_acquire().ok_or_else(|| {
        let (kind, id) = scope.describe();
        tracing::warn!(scope = kind, scope_id = %id, "rejected stream: connection limit reached");

        ApiError::new(
            ProblemCode::SseConnectionLimitReached,
            "This server is streaming to as many clients as it is configured to accept. \
             Retry shortly.",
        )
        .retryable_in(2)
    })?;

    // The interval is anchored one period out, so opening a stream does not
    // immediately emit a heartbeat — a connected client's first bytes should
    // come from a real change.
    let interval = state.events.heartbeat_interval();
    let mut heartbeat = tokio::time::interval_at(Instant::now() + interval, interval);
    // A stream that was not polled for a while wants the next heartbeat a full
    // period later, not a burst of the ones it missed.
    heartbeat.set_missed_tick_behavior(MissedTickBehavior::Delay);

    let stream = futures::stream::unfold(
        StreamState {
            scope,
            signals: state.events.subscribe(),
            shutdown: state.events.shutdown_notifier(),
            heartbeat,
            _permit: permit,
        },
        next_event,
    );

    let (kind, id) = scope.describe();
    tracing::info!(scope = kind, scope_id = %id, "track event stream opened");

    Ok(Sse::new(stream))
}

/// Everything one open stream owns.
struct StreamState {
    scope: Scope,
    signals: broadcast::Receiver<StreamSignal>,
    shutdown: watch::Receiver<bool>,
    heartbeat: tokio::time::Interval,
    /// Released when the stream is dropped, which is what frees the connection
    /// slot for the next client.
    _permit: OwnedSemaphorePermit,
}

/// One pass of the stream's select loop.
enum Step {
    Signal(Result<StreamSignal, RecvError>),
    Heartbeat,
    Shutdown,
}

/// Why a stream closed, for the one log line every degraded close produces.
enum CloseReason {
    Shutdown,
    ListenerReset,
    Lagged(u64),
    ChannelClosed,
}

/// Produces the next item of one stream, or `None` to close it.
async fn next_event(mut state: StreamState) -> Option<(Result<Event, Infallible>, StreamState)> {
    loop {
        let step = {
            // Borrowed field by field so the three futures can be awaited
            // together without borrowing the whole state twice.
            let StreamState {
                signals,
                shutdown,
                heartbeat,
                ..
            } = &mut state;

            tokio::select! {
                // Shutdown wins: a closing server should not spend its grace
                // period forwarding events.
                biased;
                changed = shutdown.changed() => match changed {
                    Ok(()) => Step::Shutdown,
                    // The handle outlives every stream, so this only happens
                    // if the router itself was dropped.
                    Err(_) => Step::Shutdown,
                },
                signal = signals.recv() => Step::Signal(signal),
                _ = heartbeat.tick() => Step::Heartbeat,
            }
        };

        match step {
            // An SSE comment: enough to keep proxies from dropping an idle
            // connection, and ignored by every conforming client.
            Step::Heartbeat => return Some((Ok(Event::default().comment("")), state)),
            Step::Shutdown => {
                close(&state.scope, CloseReason::Shutdown);
                return None;
            }
            Step::Signal(Ok(StreamSignal::Changed(notification))) => {
                if !state.scope.matches(&notification) {
                    continue;
                }

                // No `id:` field: a client must not believe it can resume from
                // one. The event id travels in the payload for correlation with
                // history, which is a different thing from a replay cursor.
                let event = Event::default()
                    .event(notification.event_type.clone())
                    .json_data(notification.as_ref())
                    .expect("a track notification is always serializable");

                return Some((Ok(event), state));
            }
            Step::Signal(Err(RecvError::Lagged(missed))) => {
                // Skipping ahead would leave the client silently wrong about
                // tracks it never saw change, so the stream closes instead.
                close(&state.scope, CloseReason::Lagged(missed));
                return None;
            }
            Step::Signal(Ok(StreamSignal::ListenerReset)) => {
                close(&state.scope, CloseReason::ListenerReset);
                return None;
            }
            Step::Signal(Err(RecvError::Closed)) => {
                close(&state.scope, CloseReason::ChannelClosed);
                return None;
            }
        }
    }
}

/// Logs the cause and the affected scope of every close, degraded or orderly.
fn close(scope: &Scope, reason: CloseReason) {
    let (kind, id) = scope.describe();

    match reason {
        CloseReason::Shutdown => {
            tracing::info!(scope = kind, scope_id = %id, "closing stream: server shutting down");
        }
        CloseReason::ListenerReset => {
            tracing::warn!(
                scope = kind,
                scope_id = %id,
                "closing stream: event listener disconnected, updates may have been missed"
            );
        }
        CloseReason::Lagged(missed) => {
            tracing::warn!(
                scope = kind,
                scope_id = %id,
                missed_events = missed,
                "closing stream: subscriber fell behind"
            );
        }
        CloseReason::ChannelClosed => {
            tracing::warn!(scope = kind, scope_id = %id, "closing stream: fan-out channel closed");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::tracks::TrackWithSongDto;
    use crate::domain::catalog::Song;
    use crate::domain::track::{LicensingState, SceneInterval, Track};
    use crate::infrastructure::notifications::TrackChangeNotification;
    use crate::infrastructure::track_repository::TrackWithSong;

    fn song() -> Song {
        Song {
            id: Uuid::from_u128(9),
            title: "Amber Lights".to_string(),
            artist_name: "The Quiet Hours".to_string(),
        }
    }

    fn track() -> Track {
        Track {
            id: Uuid::from_u128(1),
            scene_id: Uuid::from_u128(2),
            song_id: Uuid::from_u128(9),
            interval: SceneInterval::from_stored(1_000, 5_000),
            licensing_state: LicensingState::InNegotiation,
            version: 3,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    /// The promise this stream makes is that a streamed track can be applied
    /// wherever a fetched one would be. That only holds while the two shapes
    /// are identical, so the shapes are compared rather than trusted.
    #[test]
    fn a_streamed_track_has_the_same_shape_as_a_fetched_one() {
        use crate::domain::actor::Actor;
        use crate::domain::event::{NewTrackEvent, TrackDefinition};

        let track = track();
        let event = NewTrackEvent::created(
            track.id,
            Uuid::from_u128(3),
            Actor::from_display_name("Ada").unwrap(),
            TrackDefinition {
                scene_id: track.scene_id,
                song_id: track.song_id,
                interval: track.interval,
                licensing_state: track.licensing_state,
            },
        );

        let streamed =
            serde_json::to_value(TrackChangeNotification::new(1, &event, &track, &song()).track)
                .unwrap();

        let fetched = serde_json::to_value(TrackWithSongDto::from(TrackWithSong {
            track: track.clone(),
            song: song(),
        }))
        .unwrap();

        assert_eq!(streamed, fetched);
    }

    #[test]
    fn a_movie_stream_ignores_other_movies() {
        use crate::domain::actor::Actor;
        use crate::domain::event::{NewTrackEvent, TrackDefinition};

        let track = track();
        let movie_id = Uuid::from_u128(3);
        let event = NewTrackEvent::created(
            track.id,
            movie_id,
            Actor::from_display_name("Ada").unwrap(),
            TrackDefinition {
                scene_id: track.scene_id,
                song_id: track.song_id,
                interval: track.interval,
                licensing_state: track.licensing_state,
            },
        );
        let notification = TrackChangeNotification::new(1, &event, &track, &song());

        assert!(Scope::Movie(movie_id).matches(&notification));
        assert!(!Scope::Movie(Uuid::from_u128(4)).matches(&notification));
        assert!(Scope::Scene(track.scene_id).matches(&notification));
        assert!(!Scope::Scene(Uuid::from_u128(5)).matches(&notification));
    }
}
