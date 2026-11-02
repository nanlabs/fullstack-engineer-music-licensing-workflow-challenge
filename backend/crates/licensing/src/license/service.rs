use std::sync::Arc;

use chrono::{DateTime, Utc};
use errx::{AppError, AppResult};
use iam::{authz, scopes};
use kernel::{AuthContext, LicenseEventId, TrackId, UserId};
use validator::Validate;

use super::port::{EventPublisher, LicenseRepository};
use super::{
    default_source, transition, EventSource, License, LicenseChanged, LicenseError, LicenseEvent, LicenseEventKind,
    LicenseEventList, LicenseEventResponse, TransitionRequest,
};
use crate::text::normalize_optional;
use crate::track::port::TrackRepository;
use crate::track::{TrackError, TrackResponse, TrackView};

/// Upper bound of licenses expired per sweep tick.
const SWEEP_BATCH: i64 = 500;

/// License use cases. Transitions need `licenses:write` and a user to
/// attribute them to; the history needs `licenses:read`. The embedded status
/// in track responses is read with the movie scopes by the track service.
/// Every state change, from a request or from the expiry sweep, goes through
/// [`plan`] and [`LicenseRepository::apply`]: that pair is the single place a
/// license moves, so it is also the single place a [`LicenseChanged`] is
/// published, after the commit, through the [`EventPublisher`] port.
pub struct LicenseService {
    licenses: Arc<dyn LicenseRepository>,
    tracks: Arc<dyn TrackRepository>,
    publisher: Arc<dyn EventPublisher>,
}

/// One transition to record: the event and on whose behalf it is applied.
struct Step {
    event: LicenseEventKind,
    source: EventSource,
    actor_user_id: Option<UserId>,
    actor_name: Option<String>,
    note: Option<String>,
    expires_at: Option<DateTime<Utc>>,
}

impl LicenseService {
    pub fn new(
        licenses: Arc<dyn LicenseRepository>,
        tracks: Arc<dyn TrackRepository>,
        publisher: Arc<dyn EventPublisher>,
    ) -> Self {
        Self {
            licenses,
            tracks,
            publisher,
        }
    }

    /// Applies `event` to the track's license and returns the updated track.
    pub async fn transition(
        &self,
        ctx: &AuthContext,
        track_id: TrackId,
        event: LicenseEventKind,
        req: TransitionRequest,
    ) -> Result<TrackResponse, LicenseError> {
        req.validate().map_err(AppError::from)?;
        let now = Utc::now();
        check_expires_at(event, req.expires_at, now)?;
        check_source(req.source)?;
        authz::require(ctx, ctx.tenant_id, scopes::LICENSES_WRITE)?;
        let actor_user_id = authz::require_user(ctx)?;

        let view = self.load(ctx, track_id).await?;
        if let Some(expected) = req.expected_state {
            if expected != view.license.state {
                return Err(LicenseError::Stale {
                    state: view.license.state,
                });
            }
        }
        let step = Step {
            event,
            source: req.source.unwrap_or_else(|| default_source(event)),
            actor_user_id: Some(actor_user_id),
            actor_name: ctx.name.clone().or_else(|| ctx.email.clone()),
            note: normalize_optional(req.note),
            expires_at: req.expires_at,
        };
        let (license, record) = plan(&view.license, step, now)?;
        let Some(position) = self.licenses.apply(&license, &record).await? else {
            // Lost the race against another transition: report where the
            // license is now so the client can reload.
            let fresh = self.load(ctx, track_id).await?;
            return Err(LicenseError::Stale {
                state: fresh.license.state,
            });
        };
        let view = self.load(ctx, track_id).await?;
        let track = TrackResponse::from(&view);
        self.publish(changed(position, &record, track.clone())).await;
        Ok(track)
    }

    /// The license's history, oldest first.
    pub async fn history(&self, ctx: &AuthContext, track_id: TrackId) -> Result<LicenseEventList, LicenseError> {
        authz::require(ctx, ctx.tenant_id, scopes::LICENSES_READ)?;
        self.load(ctx, track_id).await?;
        let events = self.licenses.list_events(ctx.tenant_id, track_id).await?;
        Ok(LicenseEventList {
            items: events.iter().map(LicenseEventResponse::from).collect(),
            count: events.len(),
        })
    }

    /// Expires every approved license whose term ended at or before `now`.
    /// A trusted entry point (the background sweep), so there is no request
    /// context: events are recorded with `source = system` and no actor. A
    /// license expired by hand in the meantime is simply skipped (the
    /// version guard says so). Returns how many were expired.
    pub async fn expire_due(&self, now: DateTime<Utc>) -> AppResult<usize> {
        let due = self.licenses.due_for_expiry(now, SWEEP_BATCH).await?;
        let mut expired = 0;
        for license in &due {
            let step = Step {
                event: LicenseEventKind::Expire,
                source: EventSource::System,
                actor_user_id: None,
                actor_name: None,
                note: None,
                expires_at: None,
            };
            let Ok((next, record)) = plan(license, step, now) else {
                continue;
            };
            let Some(position) = self.licenses.apply(&next, &record).await? else {
                continue;
            };
            expired += 1;
            // The track may have been deleted between the read and here (its
            // events went with it); then there is nothing to announce.
            if let Some(view) = self.tracks.get(license.tenant_id, license.track_id).await? {
                self.publish(changed(position, &record, TrackResponse::from(&view)))
                    .await;
            }
        }
        Ok(expired)
    }

    /// Announces a committed transition. A transport failure is logged, not
    /// returned: the change is already in `license_events`, which is what a
    /// client replays when it reconnects.
    async fn publish(&self, event: LicenseChanged) {
        let (position, track_id) = (event.position, event.track.id);
        if let Err(error) = self.publisher.publish(event).await {
            tracing::warn!(
                error = %error,
                position,
                track_id = %track_id,
                "license change not published; clients catch up on reconnect"
            );
        }
    }

    async fn load(&self, ctx: &AuthContext, track_id: TrackId) -> Result<TrackView, LicenseError> {
        self.tracks
            .get(ctx.tenant_id, track_id)
            .await?
            .ok_or(LicenseError::Track(TrackError::NotFound))
    }
}

/// `system` is the sweep's signature, never a client's claim.
fn check_source(source: Option<EventSource>) -> Result<(), AppError> {
    if source == Some(EventSource::System) {
        return Err(AppError::validation("source 'system' is reserved for the expiry sweep").detail("field", "source"));
    }
    Ok(())
}

/// `expires_at` describes the approved term: only `approve` may set it and
/// it must lie ahead of `now`.
fn check_expires_at(
    event: LicenseEventKind,
    expires_at: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> Result<(), AppError> {
    let Some(expires_at) = expires_at else {
        return Ok(());
    };
    if event != LicenseEventKind::Approve {
        return Err(AppError::validation("expires_at is only accepted with approve").detail("field", "expires_at"));
    }
    if expires_at <= now {
        return Err(AppError::validation("expires_at must be in the future").detail("field", "expires_at"));
    }
    Ok(())
}

/// The transition itself: the next license (state, version, term) and the
/// event that records it. Pure, so the request path and the sweep share it.
fn plan(license: &License, step: Step, now: DateTime<Utc>) -> Result<(License, LicenseEvent), LicenseError> {
    let to = transition(license.state, step.event)?;
    let expires_at = if step.event == LicenseEventKind::Approve {
        step.expires_at
    } else {
        license.expires_at
    };
    let next = License {
        state: to,
        version: license.version + 1,
        expires_at,
        updated_at: now,
        ..license.clone()
    };
    let record = LicenseEvent {
        id: LicenseEventId::generate(),
        tenant_id: license.tenant_id,
        track_id: license.track_id,
        seq: next.version,
        kind: step.event,
        from_state: license.state,
        to_state: to,
        source: step.source,
        actor_user_id: step.actor_user_id,
        actor_name: step.actor_name,
        note: step.note,
        created_at: now,
    };
    Ok((next, record))
}

/// The published shape of a stored event: the transition plus the track as
/// it reads after it.
fn changed(position: i64, record: &LicenseEvent, track: TrackResponse) -> LicenseChanged {
    LicenseChanged {
        position,
        tenant_id: record.tenant_id,
        event: record.kind,
        from_state: record.from_state,
        to_state: record.to_state,
        source: record.source,
        seq: record.seq,
        occurred_at: record.created_at,
        track,
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use kernel::{SceneId, SongId, TenantId};
    use serde_json::{json, Value};
    use tokio::sync::broadcast::error::TryRecvError;

    use super::*;
    use crate::events::bus::EventBus;
    use crate::license::LicenseState;
    use crate::scene::port::SceneRepository;
    use crate::testing::{self, ctx, ctx_named, FailingPublisher, FakeMovies, FakeScenes, FakeTracks};
    use crate::track::{Track, TrackUsage};

    struct Harness {
        service: LicenseService,
        tracks: Arc<FakeTracks>,
        /// What the service publishes to (unless built with another publisher).
        bus: EventBus,
        tenant: TenantId,
        scene: SceneId,
        song: SongId,
        /// A track whose license is `pending`.
        track: TrackId,
    }

    async fn harness() -> Harness {
        build(None).await
    }

    async fn build(publisher: Option<Arc<dyn EventPublisher>>) -> Harness {
        let tenant = TenantId::generate();
        let movies = Arc::new(FakeMovies::default());
        let movie = testing::movie(tenant, "Seeded");
        movies.rows.lock().unwrap().push(movie.clone());
        let scenes = Arc::new(FakeScenes::default());
        let scene = scenes
            .insert(&testing::scene(tenant, movie.id, "Opening", None))
            .await
            .unwrap()
            .unwrap();
        let tracks = Arc::new(FakeTracks::new(scenes));
        let song = tracks.add_song(tenant, "Velvet Static");
        let track = cue(tenant, scene.id, song);
        tracks.insert(&track).await.unwrap();
        let bus = EventBus::new(16);
        let publisher = publisher.unwrap_or_else(|| Arc::new(bus.clone()));
        Harness {
            service: LicenseService::new(tracks.clone(), tracks.clone(), publisher),
            tracks,
            bus,
            tenant,
            scene: scene.id,
            song,
            track: track.id,
        }
    }

    fn cue(tenant_id: TenantId, scene_id: SceneId, song_id: SongId) -> Track {
        let now = Utc::now();
        Track {
            id: TrackId::generate(),
            tenant_id,
            scene_id,
            song_id,
            start_ms: 0,
            end_ms: 1000,
            usage: TrackUsage::Background,
            created_at: now,
            updated_at: now,
        }
    }

    fn body(value: Value) -> TransitionRequest {
        serde_json::from_value(value).unwrap()
    }

    fn manager(tenant: TenantId) -> AuthContext {
        ctx_named(tenant, &["movies:*", "licenses:*"], Some("Licensing Manager"))
    }

    fn code(err: LicenseError) -> String {
        AppError::from(err).code().to_owned()
    }

    #[tokio::test]
    async fn transition_requires_write_scope() {
        let h = harness().await;
        let reader = ctx(h.tenant, &["movies:*", "licenses:read"]);
        let err = AppError::from(
            h.service
                .transition(&reader, h.track, LicenseEventKind::Request, body(json!({})))
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "licenses:write");
        // Validation runs before authorization, like everywhere else.
        let err = AppError::from(
            h.service
                .transition(
                    &ctx(h.tenant, &[]),
                    h.track,
                    LicenseEventKind::Request,
                    body(json!({ "note": "x".repeat(2001) })),
                )
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn follows_the_table_and_logs_the_event() {
        let h = harness().await;
        let m = manager(h.tenant);
        let track = h
            .service
            .transition(&m, h.track, LicenseEventKind::Request, body(json!({})))
            .await
            .unwrap();
        assert_eq!(track.id, h.track);
        assert_eq!(track.license.state, LicenseState::Requested);
        assert_eq!(
            track.license.allowed_events,
            &[LicenseEventKind::StartNegotiation, LicenseEventKind::Reject]
        );

        let track = h
            .service
            .transition(
                &m,
                h.track,
                LicenseEventKind::StartNegotiation,
                body(json!({ "note": "  Holder asks to see the scene.  " })),
            )
            .await
            .unwrap();
        assert_eq!(track.license.state, LicenseState::Negotiating);

        let history = h.service.history(&m, h.track).await.unwrap();
        assert_eq!(history.count, 2);
        let first = &history.items[0];
        assert_eq!((first.seq, first.event), (1, LicenseEventKind::Request));
        assert_eq!(
            (first.from_state, first.to_state),
            (LicenseState::Pending, LicenseState::Requested)
        );
        assert_eq!(first.source, EventSource::Acme);
        let actor = first.actor.as_ref().unwrap();
        assert_eq!(actor.user_id, m.user_id());
        assert_eq!(actor.name.as_deref(), Some("Licensing Manager"));
        assert_eq!(first.note, None);
        let second = &history.items[1];
        assert_eq!((second.seq, second.event), (2, LicenseEventKind::StartNegotiation));
        assert_eq!(second.source, EventSource::RightsHolder);
        assert_eq!(second.note.as_deref(), Some("Holder asks to see the scene."));
    }

    #[tokio::test]
    async fn invalid_transition_is_422_with_allowed_events() {
        let h = harness().await;
        let m = manager(h.tenant);
        let err = AppError::from(
            h.service
                .transition(&m, h.track, LicenseEventKind::Approve, body(json!({})))
                .await
                .unwrap_err(),
        );
        assert_eq!(
            (err.code(), err.kind().http_status()),
            ("LICENSE_INVALID_TRANSITION", 422)
        );
        assert_eq!(err.details()["state"], "pending");
        assert_eq!(err.details()["event"], "approve");
        assert_eq!(err.details()["allowed_events"], json!(["request"]));
        // Nothing was recorded.
        assert_eq!(h.service.history(&m, h.track).await.unwrap().count, 0);
    }

    #[tokio::test]
    async fn expected_state_mismatch_is_stale() {
        let h = harness().await;
        let m = manager(h.tenant);
        let err = AppError::from(
            h.service
                .transition(
                    &m,
                    h.track,
                    LicenseEventKind::Request,
                    body(json!({ "expected_state": "requested" })),
                )
                .await
                .unwrap_err(),
        );
        assert_eq!((err.code(), err.kind().http_status()), ("LICENSE_STATE_STALE", 409));
        assert_eq!(err.details()["state"], "pending");
        // The matching expectation goes through.
        let track = h
            .service
            .transition(
                &m,
                h.track,
                LicenseEventKind::Request,
                body(json!({ "expected_state": "pending" })),
            )
            .await
            .unwrap();
        assert_eq!(track.license.state, LicenseState::Requested);
    }

    #[tokio::test]
    async fn expires_at_only_with_approve_and_in_the_future() {
        let h = harness().await;
        let m = manager(h.tenant);
        let future = Utc::now() + Duration::days(365);
        let err = AppError::from(
            h.service
                .transition(
                    &m,
                    h.track,
                    LicenseEventKind::Request,
                    body(json!({ "expires_at": future })),
                )
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "expires_at");

        for event in [LicenseEventKind::Request, LicenseEventKind::StartNegotiation] {
            h.service.transition(&m, h.track, event, body(json!({}))).await.unwrap();
        }
        let past = Utc::now() - Duration::minutes(1);
        let err = AppError::from(
            h.service
                .transition(
                    &m,
                    h.track,
                    LicenseEventKind::Approve,
                    body(json!({ "expires_at": past })),
                )
                .await
                .unwrap_err(),
        );
        assert_eq!(err.details()["field"], "expires_at");

        let track = h
            .service
            .transition(
                &m,
                h.track,
                LicenseEventKind::Approve,
                body(json!({ "expires_at": future, "note": "Five years, worldwide." })),
            )
            .await
            .unwrap();
        assert_eq!(track.license.state, LicenseState::Approved);
        assert_eq!(track.license.expires_at, Some(future));
        assert_eq!(track.license.allowed_events, &[LicenseEventKind::Expire]);

        // A manual expire keeps the stored date.
        let track = h
            .service
            .transition(&m, h.track, LicenseEventKind::Expire, body(json!({})))
            .await
            .unwrap();
        assert_eq!(track.license.state, LicenseState::Expired);
        assert_eq!(track.license.expires_at, Some(future));
        assert!(track.license.allowed_events.is_empty());
    }

    #[tokio::test]
    async fn concurrent_transition_is_stale() {
        let h = harness().await;
        let m = manager(h.tenant);
        *h.tracks.fail_next_apply.lock().unwrap() = true;
        let err = AppError::from(
            h.service
                .transition(&m, h.track, LicenseEventKind::Request, body(json!({})))
                .await
                .unwrap_err(),
        );
        assert_eq!((err.code(), err.kind().http_status()), ("LICENSE_STATE_STALE", 409));
        assert_eq!(err.details()["state"], "pending");
        assert_eq!(h.service.history(&m, h.track).await.unwrap().count, 0);

        // The repository guard itself: two plans from the same version, the
        // second one loses.
        let license = h.tracks.license_of_test(h.track);
        let step = || Step {
            event: LicenseEventKind::Request,
            source: EventSource::Acme,
            actor_user_id: None,
            actor_name: None,
            note: None,
            expires_at: None,
        };
        let (a, ea) = plan(&license, step(), Utc::now()).unwrap();
        let (b, eb) = plan(&license, step(), Utc::now()).unwrap();
        assert!(h.tracks.apply(&a, &ea).await.unwrap().is_some());
        assert!(h.tracks.apply(&b, &eb).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn transition_publishes_license_changed() {
        let h = harness().await;
        let m = manager(h.tenant);
        let mut rx = h.bus.subscribe();
        h.service
            .transition(
                &m,
                h.track,
                LicenseEventKind::Request,
                body(json!({ "note": "secret" })),
            )
            .await
            .unwrap();
        let event = rx.recv().await.unwrap();
        assert_eq!(event.position, 1);
        assert_eq!(event.tenant_id, h.tenant);
        assert_eq!(event.event, LicenseEventKind::Request);
        assert_eq!(
            (event.from_state, event.to_state),
            (LicenseState::Pending, LicenseState::Requested)
        );
        assert_eq!((event.source, event.seq), (EventSource::Acme, 1));
        assert_eq!(event.track.id, h.track);
        assert_eq!(event.track.license.state, LicenseState::Requested);
        // The stream is read with `movies:read`: no note, no actor.
        let json = serde_json::to_value(&event).unwrap();
        assert!(json.get("note").is_none() && json.get("actor").is_none());

        h.service
            .transition(&m, h.track, LicenseEventKind::Reject, body(json!({})))
            .await
            .unwrap();
        assert_eq!(rx.recv().await.unwrap().position, 2);
        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
    }

    #[tokio::test]
    async fn stale_transition_publishes_nothing() {
        let h = harness().await;
        let m = manager(h.tenant);
        let mut rx = h.bus.subscribe();
        *h.tracks.fail_next_apply.lock().unwrap() = true;
        h.service
            .transition(&m, h.track, LicenseEventKind::Request, body(json!({})))
            .await
            .unwrap_err();
        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
    }

    #[tokio::test]
    async fn expire_due_publishes_system_events() {
        let h = harness().await;
        let now = Utc::now();
        h.tracks
            .set_license(h.track, LicenseState::Approved, Some(now - Duration::minutes(1)));
        let mut rx = h.bus.subscribe();
        assert_eq!(h.service.expire_due(now).await.unwrap(), 1);
        let event = rx.recv().await.unwrap();
        assert_eq!(
            (event.event, event.source),
            (LicenseEventKind::Expire, EventSource::System)
        );
        assert_eq!(event.track.id, h.track);
        assert_eq!(event.track.license.state, LicenseState::Expired);
    }

    #[tokio::test]
    async fn publisher_failure_does_not_fail_the_transition() {
        let h = build(Some(Arc::new(FailingPublisher))).await;
        let m = manager(h.tenant);
        let track = h
            .service
            .transition(&m, h.track, LicenseEventKind::Request, body(json!({})))
            .await
            .unwrap();
        assert_eq!(track.license.state, LicenseState::Requested);
        assert_eq!(h.service.history(&m, h.track).await.unwrap().count, 1);
    }

    #[tokio::test]
    async fn source_system_is_rejected_from_requests() {
        let h = harness().await;
        let m = manager(h.tenant);
        let err = AppError::from(
            h.service
                .transition(
                    &m,
                    h.track,
                    LicenseEventKind::Request,
                    body(json!({ "source": "system" })),
                )
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "source");
        assert_eq!(h.service.history(&m, h.track).await.unwrap().count, 0);
    }

    #[tokio::test]
    async fn expire_due_moves_only_due_licenses() {
        let h = harness().await;
        let m = manager(h.tenant);
        let now = Utc::now();
        let due = cue(h.tenant, h.scene, h.song);
        let later = cue(h.tenant, h.scene, h.song);
        let open = cue(h.tenant, h.scene, h.song);
        for t in [&due, &later, &open] {
            h.tracks.insert(t).await.unwrap();
        }
        h.tracks
            .set_license(due.id, LicenseState::Approved, Some(now - Duration::minutes(1)));
        h.tracks
            .set_license(later.id, LicenseState::Approved, Some(now + Duration::days(30)));
        h.tracks.set_license(open.id, LicenseState::Approved, None);

        assert_eq!(h.service.expire_due(now).await.unwrap(), 1);
        let history = h.service.history(&m, due.id).await.unwrap();
        assert_eq!(history.count, 1);
        let event = &history.items[0];
        assert_eq!(event.event, LicenseEventKind::Expire);
        assert_eq!(event.source, EventSource::System);
        assert!(event.actor.is_none());
        assert_eq!(h.tracks.license_of_test(due.id).state, LicenseState::Expired);
        assert_eq!(h.tracks.license_of_test(later.id).state, LicenseState::Approved);
        assert_eq!(h.tracks.license_of_test(open.id).state, LicenseState::Approved);
        // Idempotent: nothing left to expire.
        assert_eq!(h.service.expire_due(now).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn history_requires_read_scope_and_track() {
        let h = harness().await;
        let viewer = ctx(h.tenant, &["movies:read"]);
        let err = AppError::from(h.service.history(&viewer, h.track).await.unwrap_err());
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "licenses:read");
        let m = manager(h.tenant);
        assert_eq!(
            code(h.service.history(&m, TrackId::generate()).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
        assert_eq!(h.service.history(&m, h.track).await.unwrap().count, 0);
    }

    #[tokio::test]
    async fn tenants_are_isolated() {
        let h = harness().await;
        let outsider = manager(TenantId::generate());
        assert_eq!(
            code(
                h.service
                    .transition(&outsider, h.track, LicenseEventKind::Request, body(json!({})))
                    .await
                    .unwrap_err()
            ),
            "TRACK_NOT_FOUND"
        );
        assert_eq!(
            code(h.service.history(&outsider, h.track).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
    }
}
