//! Races that only a real PostgreSQL reproduces: the real repositories, the
//! real `position` sequence and the per-tenant lock of `license_events`.
//! Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p licensing -- --include-ignored
//! ```

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use errx::AppResult;
use futures_util::StreamExt;
use kernel::{Actor, AuthContext, TenantId, TrackId, UserId};
use licensing::events::bus::EventBus;
use licensing::events::service::EventStreamService;
use licensing::events::EventsConfig;
use licensing::license::infra::postgres::PostgresLicenseRepository;
use licensing::license::port::EventPublisher;
use licensing::license::service::LicenseService;
use licensing::license::{LicenseChanged, LicenseEventKind, TransitionRequest};
use licensing::track::infra::postgres::PostgresTrackRepository;
use serde_json::Value;
use sqlx::PgPool;
use tokio::sync::Notify;
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;

/// Seed tracks of ACME: Rooftop is `negotiating`, Final bow is `pending`.
const T_ROOFTOP: &str = "77777777-7777-4777-8777-777777777772";
const T_FINAL_BOW: &str = "77777777-7777-4777-8777-777777777773";

/// The in-process publisher, except that the announcement of one track
/// waits until the test releases it: the transition is committed, nobody
/// has heard about it yet.
struct PausedPublisher {
    bus: EventBus,
    paused: TrackId,
    entered: Notify,
    release: Notify,
}

#[async_trait]
impl EventPublisher for PausedPublisher {
    async fn publish(&self, event: LicenseChanged) -> AppResult<()> {
        if event.track.id == self.paused {
            self.entered.notify_one();
            self.release.notified().await;
        }
        self.bus.emit(event);
        Ok(())
    }
}

/// The seed admin as the middleware would present them (events record the
/// actor, which the schema checks against `users`).
async fn admin(pool: &PgPool) -> AuthContext {
    let tenant_id: TenantId = iam::testing::ACME_TENANT.parse().unwrap();
    let user_id: UserId = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 AND email = $2")
        .bind(tenant_id)
        .bind(iam::testing::ACME_ADMIN_EMAIL)
        .fetch_one(pool)
        .await
        .unwrap();
    AuthContext {
        actor: Actor::user(user_id),
        tenant_id,
        session_id: None,
        email: Some(iam::testing::ACME_ADMIN_EMAIL.to_owned()),
        name: Some("ACME Admin".to_owned()),
        scopes: vec!["movies:read".to_owned(), "licenses:write".to_owned()],
    }
}

/// The next `license.changed` frame: its position and the track it carries.
async fn next_change<S>(stream: &mut S) -> (i64, TrackId)
where
    S: futures_util::Stream<Item = actix_web::web::Bytes> + Unpin,
{
    let frame = timeout(Duration::from_secs(2), stream.next())
        .await
        .expect("a frame within 2s")
        .expect("the stream is open");
    let frame = String::from_utf8(frame.to_vec()).unwrap();
    let mut lines = frame.lines();
    assert_eq!(lines.next(), Some("event: license.changed"), "{frame}");
    let id = lines.next().unwrap().strip_prefix("id: ").unwrap().parse().unwrap();
    let data: Value = serde_json::from_str(lines.next().unwrap().strip_prefix("data: ").unwrap()).unwrap();
    (id, data["track"]["id"].as_str().unwrap().parse().unwrap())
}

/// Two transitions commit in one order and are announced in the other: the
/// stream must deliver both, in commit order, without waiting for the late
/// announcement (the bus is a wake-up, the log is the stream).
#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn a_transition_announced_late_is_delivered_in_commit_order(pool: PgPool) {
    let final_bow: TrackId = T_FINAL_BOW.parse().unwrap();
    let rooftop: TrackId = T_ROOFTOP.parse().unwrap();
    let bus = EventBus::new(32);
    let licenses = Arc::new(PostgresLicenseRepository::new(pool.clone()));
    let tracks = Arc::new(PostgresTrackRepository::new(pool.clone()));
    let publisher = Arc::new(PausedPublisher {
        bus: bus.clone(),
        paused: final_bow,
        entered: Notify::new(),
        release: Notify::new(),
    });
    let service = Arc::new(LicenseService::new(licenses.clone(), tracks, publisher.clone()));
    let events = EventStreamService::new(licenses, bus, EventsConfig::default(), CancellationToken::new());
    let manager = admin(&pool).await;

    let mut stream = Box::pin(events.open(&manager, None).await.unwrap());
    stream.next().await.unwrap(); // retry
    stream.next().await.unwrap(); // connected

    // Final bow: committed first, announcement held.
    let first = tokio::spawn({
        let service = service.clone();
        let manager = manager.clone();
        async move {
            service
                .transition(
                    &manager,
                    final_bow,
                    LicenseEventKind::Request,
                    TransitionRequest::default(),
                )
                .await
        }
    });
    timeout(Duration::from_secs(5), publisher.entered.notified())
        .await
        .expect("the first transition should reach its publication");

    // Rooftop: committed second, announced first.
    service
        .transition(
            &manager,
            rooftop,
            LicenseEventKind::Reject,
            TransitionRequest::default(),
        )
        .await
        .unwrap();

    // One wake-up, one read of the log: both events, in position order.
    let (first_position, first_track) = next_change(&mut stream).await;
    let (second_position, second_track) = next_change(&mut stream).await;
    assert_eq!((first_track, second_track), (final_bow, rooftop));
    assert!(first_position < second_position, "{first_position} < {second_position}");

    // The late announcement finds nothing new.
    publisher.release.notify_one();
    first.await.unwrap().unwrap();
    assert!(
        timeout(Duration::from_millis(300), stream.next()).await.is_err(),
        "nothing else should arrive"
    );
}
