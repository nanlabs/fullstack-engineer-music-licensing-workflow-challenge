//! Opens a tenant's stream: the events missed since `Last-Event-ID`,
//! replayed from `license_events`, then live events.
//!
//! The bus is a wake-up; the log is the stream. A live stream never forwards
//! what it hears on the bus. A notice (any position of its tenant, or
//! `Lagged`) only says the log grew, and the stream reads `license_events`
//! after the last position it sent, in position order. Publication happens
//! after the commit and outside the per-tenant lock, so two transitions can
//! be announced in the reverse of their positions; reading the log makes
//! that harmless, and the lock guarantees that when position N+1 is
//! committed so is N, so no read can jump over a gap. Missing notices
//! (`Lagged`) costs one bigger read, never an event. The order of operations
//! keeps the cursor exact: subscribe to the bus *first*, then replay, then
//! go live. A read longer than `replay_limit`, at connect time or live, ends
//! in a `resync` event, which asks the client to reload its lists and keep
//! listening. Without `Last-Event-ID` the cursor starts at the head of the
//! log read right after subscribing: what was committed before the connect
//! is in the lists the client loads, what comes after is in the stream.

use std::collections::VecDeque;
use std::sync::Arc;

use actix_web::web::Bytes;
use errx::{AppError, AppResult};
use futures_util::stream::{self, Stream, StreamExt};
use iam::{authz, scopes};
use kernel::{AuthContext, TenantId};
use tokio::sync::broadcast::error::{RecvError, TryRecvError};
use tokio::sync::broadcast::Receiver;
use tokio::time::{self, Instant, Interval, MissedTickBehavior};
use tokio_util::sync::CancellationToken;

use super::bus::EventBus;
use super::{sse, EventsConfig, EVENT_LICENSE_CHANGED, EVENT_RESYNC, RETRY};
use crate::license::port::LicenseRepository;
use crate::license::LicenseChanged;

pub struct EventStreamService {
    licenses: Arc<dyn LicenseRepository>,
    bus: EventBus,
    config: EventsConfig,
    shutdown: CancellationToken,
}

impl EventStreamService {
    pub fn new(
        licenses: Arc<dyn LicenseRepository>,
        bus: EventBus,
        config: EventsConfig,
        shutdown: CancellationToken,
    ) -> Self {
        Self {
            licenses,
            bus,
            config,
            shutdown,
        }
    }

    /// The stream of the caller's tenant, as encoded SSE messages. Needs
    /// `movies:read`, the scope of the status it carries. `last_event_id`
    /// is the position the client last saw; with it, what came after is
    /// replayed before the live events.
    pub async fn open(
        &self,
        ctx: &AuthContext,
        last_event_id: Option<i64>,
    ) -> Result<impl Stream<Item = Bytes> + Send + 'static, AppError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let tenant_id = ctx.tenant_id;
        // Subscribe before the replay so nothing committed in between is lost.
        let rx = self.bus.subscribe();
        let limit = self.config.replay_limit;

        let mut frames = vec![sse::retry(RETRY), sse::comment("connected")];
        let mut replayed = 0;
        let last = match last_event_id {
            Some(after) => {
                let batch = catch_up(&*self.licenses, tenant_id, after, limit).await?;
                replayed = batch.events;
                frames.extend(batch.frames);
                batch.last
            }
            None => self.licenses.head_position(tenant_id).await?,
        };
        tracing::info!(
            tenant_id = %tenant_id,
            last_event_id,
            replayed,
            streams = self.bus.receiver_count(),
            "event stream opened"
        );

        let now = Instant::now();
        let mut keep_alive = time::interval_at(now + self.config.keep_alive_interval, self.config.keep_alive_interval);
        keep_alive.set_missed_tick_behavior(MissedTickBehavior::Delay);
        let live = Live {
            licenses: self.licenses.clone(),
            rx,
            tenant_id,
            last,
            limit,
            pending: VecDeque::new(),
            keep_alive,
            deadline: now + self.config.max_connection_age,
            shutdown: self.shutdown.clone(),
        };
        Ok(stream::iter(frames).chain(stream::unfold(live, Live::next)))
    }
}

/// What one read of the log yields.
struct Batch {
    /// One `license.changed` frame per event, in position order, then a
    /// `resync` when there were more than the limit.
    frames: Vec<Bytes>,
    /// Events in `frames`.
    events: usize,
    /// Position of the last event in `frames`; the cursor the next read
    /// starts after (`after` itself when nothing was read).
    last: i64,
}

/// Reads the tenant's events after `after`, at most `limit`, as frames. One
/// row past the limit is requested to know whether the read is complete; if
/// not, the frames end with `resync` and the cursor stays at the last event
/// read, so later reads continue from there and nothing is skipped.
async fn catch_up(licenses: &dyn LicenseRepository, tenant_id: TenantId, after: i64, limit: i64) -> AppResult<Batch> {
    let mut changes = licenses.changes_since(tenant_id, after, limit + 1).await?;
    let truncated = changes.len() as i64 > limit;
    changes.truncate(limit as usize);
    let mut batch = Batch {
        frames: Vec::with_capacity(changes.len() + usize::from(truncated)),
        events: changes.len(),
        last: after,
    };
    for change in &changes {
        batch.last = change.position;
        batch.frames.push(frame(change));
    }
    if truncated {
        batch.frames.push(resync("replay_truncated"));
    }
    Ok(batch)
}

/// State of the live phase of one stream.
struct Live {
    licenses: Arc<dyn LicenseRepository>,
    rx: Receiver<LicenseChanged>,
    tenant_id: TenantId,
    /// Position of the last event sent; every read of the log starts after it.
    last: i64,
    /// Most events one read delivers before asking for a `resync`.
    limit: i64,
    /// Frames read from the log and not yet handed to the stream.
    pending: VecDeque<Bytes>,
    keep_alive: Interval,
    /// When the stream is closed so the client reconnects and re-authenticates.
    deadline: Instant,
    shutdown: CancellationToken,
}

impl Live {
    async fn next(mut self) -> Option<(Bytes, Self)> {
        loop {
            if let Some(frame) = self.pending.pop_front() {
                return Some((frame, self));
            }
            tokio::select! {
                biased;
                _ = self.shutdown.cancelled() => return None,
                _ = time::sleep_until(self.deadline) => return None,
                _ = self.keep_alive.tick() => return Some((sse::comment("keep-alive"), self)),
                received = self.rx.recv() => match received {
                    Ok(event) if event.tenant_id == self.tenant_id => {}
                    Ok(_) => continue,
                    Err(RecvError::Lagged(skipped)) => {
                        tracing::debug!(tenant_id = %self.tenant_id, skipped, "event stream lagged behind the bus; reading the log");
                    }
                    Err(RecvError::Closed) => return None,
                },
            }
            // The log grew. Notices already queued are the same wake-up, so
            // a burst costs one read, not one per event.
            self.drain_notices();
            match catch_up(&*self.licenses, self.tenant_id, self.last, self.limit).await {
                Ok(batch) => {
                    self.last = batch.last;
                    self.pending.extend(batch.frames);
                }
                Err(error) => {
                    // Ending the stream makes the browser reconnect with
                    // `Last-Event-ID`, which reads again from the same cursor.
                    tracing::warn!(tenant_id = %self.tenant_id, error = %error, "event stream could not read the log; closing");
                    return None;
                }
            }
        }
    }

    fn drain_notices(&mut self) {
        loop {
            match self.rx.try_recv() {
                Ok(_) | Err(TryRecvError::Lagged(_)) => continue,
                Err(TryRecvError::Empty | TryRecvError::Closed) => return,
            }
        }
    }
}

fn frame(event: &LicenseChanged) -> Bytes {
    let json = serde_json::to_string(event).expect("LicenseChanged serializes");
    sse::data(EVENT_LICENSE_CHANGED, Some(event.position), &json)
}

fn resync(reason: &str) -> Bytes {
    sse::data(EVENT_RESYNC, None, &format!(r#"{{"reason":"{reason}"}}"#))
}

#[cfg(test)]
mod tests {
    use std::pin::Pin;
    use std::sync::Mutex;
    use std::time::Duration;

    use async_trait::async_trait;
    use chrono::{DateTime, Utc};
    use errx::AppResult;
    use futures_util::StreamExt;
    use kernel::TrackId;
    use tokio::time::timeout;

    use super::*;
    use crate::license::{License, LicenseEvent};
    use crate::testing::{changed_in, ctx};

    /// Only the reading side of the port matters here: the log as the
    /// stream sees it, and a switch to make the next read fail.
    #[derive(Default)]
    struct FakeChanges {
        rows: Mutex<Vec<LicenseChanged>>,
        fail: Mutex<bool>,
    }

    #[async_trait]
    impl LicenseRepository for FakeChanges {
        async fn apply(&self, _: &License, _: &LicenseEvent) -> AppResult<Option<i64>> {
            unreachable!()
        }
        async fn list_events(&self, _: TenantId, _: TrackId) -> AppResult<Vec<LicenseEvent>> {
            unreachable!()
        }
        async fn head_position(&self, tenant_id: TenantId) -> AppResult<i64> {
            Ok(self
                .rows
                .lock()
                .unwrap()
                .iter()
                .filter(|c| c.tenant_id == tenant_id)
                .map(|c| c.position)
                .max()
                .unwrap_or(0))
        }
        async fn changes_since(&self, tenant_id: TenantId, after: i64, limit: i64) -> AppResult<Vec<LicenseChanged>> {
            if *self.fail.lock().unwrap() {
                return Err(AppError::internal("log unavailable"));
            }
            let mut rows: Vec<LicenseChanged> = self
                .rows
                .lock()
                .unwrap()
                .iter()
                .filter(|c| c.tenant_id == tenant_id && c.position > after)
                .cloned()
                .collect();
            rows.sort_by_key(|c| c.position);
            rows.truncate(limit as usize);
            Ok(rows)
        }
        async fn due_for_expiry(&self, _: DateTime<Utc>, _: i64) -> AppResult<Vec<License>> {
            unreachable!()
        }
    }

    struct Harness {
        service: EventStreamService,
        bus: EventBus,
        log: Arc<FakeChanges>,
        tenant: TenantId,
        shutdown: CancellationToken,
    }

    impl Harness {
        /// A transition committed to the log: what a read returns.
        fn commit(&self, position: i64) {
            self.log.rows.lock().unwrap().push(changed_in(self.tenant, position));
        }

        /// The notice the publisher sends after the commit.
        fn emit(&self, position: i64) {
            self.bus.emit(changed_in(self.tenant, position));
        }
    }

    fn harness(stored: &[i64], config: EventsConfig, capacity: usize) -> Harness {
        let tenant = TenantId::generate();
        let log = Arc::new(FakeChanges::default());
        let bus = EventBus::new(capacity);
        let shutdown = CancellationToken::new();
        let h = Harness {
            service: EventStreamService::new(log.clone(), bus.clone(), config, shutdown.clone()),
            bus,
            log,
            tenant,
            shutdown,
        };
        for position in stored {
            h.commit(*position);
        }
        h
    }

    fn slow() -> EventsConfig {
        EventsConfig {
            keep_alive_interval: Duration::from_secs(3600),
            max_connection_age: Duration::from_secs(7200),
            replay_limit: 500,
        }
    }

    type Frames = Pin<Box<dyn Stream<Item = Bytes> + Send>>;

    async fn open(h: &Harness, last: Option<i64>) -> Frames {
        let ctx = ctx(h.tenant, &["movies:read"]);
        Box::pin(h.service.open(&ctx, last).await.unwrap())
    }

    /// The next frame as text, or `None` if the stream ended or nothing
    /// arrived within the (paused, auto-advanced) timeout.
    async fn next(frames: &mut Frames) -> Option<String> {
        timeout(Duration::from_millis(500), frames.next())
            .await
            .ok()
            .flatten()
            .map(|b| String::from_utf8(b.to_vec()).unwrap())
    }

    fn id_of(frame: &str) -> i64 {
        frame
            .lines()
            .find_map(|l| l.strip_prefix("id: "))
            .expect("frame has an id")
            .parse()
            .unwrap()
    }

    const RESYNC: &str = "event: resync\ndata: {\"reason\":\"replay_truncated\"}\n\n";

    #[tokio::test]
    async fn requires_movies_read() {
        let h = harness(&[], slow(), 8);
        let err = h
            .service
            .open(&ctx(h.tenant, &["licenses:read"]), None)
            .await
            .err()
            .unwrap();
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "movies:read");
    }

    #[tokio::test(start_paused = true)]
    async fn starts_with_retry_and_a_comment_then_goes_live() {
        let h = harness(&[], slow(), 8);
        let mut frames = open(&h, None).await;
        assert_eq!(next(&mut frames).await.as_deref(), Some("retry: 3000\n\n"));
        assert_eq!(next(&mut frames).await.as_deref(), Some(": connected\n\n"));
        assert_eq!(next(&mut frames).await, None, "nothing happened yet");

        h.commit(1);
        h.emit(1);
        let frame = next(&mut frames).await.unwrap();
        assert!(frame.starts_with("event: license.changed\nid: 1\ndata: {"), "{frame}");
        assert!(frame.ends_with("\n\n"));
        let json: serde_json::Value =
            serde_json::from_str(frame.lines().nth(2).unwrap().strip_prefix("data: ").unwrap()).unwrap();
        assert_eq!(json["position"], 1);
        assert_eq!(json["to_state"], "requested");
        assert_eq!(json["track"]["license"]["state"], "requested");
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn without_last_event_id_the_stream_starts_at_the_head() {
        let h = harness(&[1, 2, 3], slow(), 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await; // retry
        next(&mut frames).await; // connected
        assert_eq!(next(&mut frames).await, None, "history is not replayed");
        h.commit(4);
        h.emit(4);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 4);
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn replays_after_last_event_id_then_goes_live() {
        let h = harness(&[1, 2, 3], slow(), 8);
        let mut frames = open(&h, Some(1)).await;
        next(&mut frames).await; // retry
        next(&mut frames).await; // connected
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 2);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 3);
        assert_eq!(next(&mut frames).await, None);
        // A notice is only a wake-up: a stale one still finds the new
        // event in the log, and the second finds nothing new.
        h.commit(4);
        h.emit(3);
        h.emit(4);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 4);
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn other_tenants_are_filtered_out() {
        let h = harness(&[1], slow(), 8);
        let other = TenantId::generate();
        let mut frames = open(&h, Some(0)).await;
        next(&mut frames).await;
        next(&mut frames).await;
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 1);
        h.log.rows.lock().unwrap().push(changed_in(other, 2));
        h.bus.emit(changed_in(other, 2));
        assert_eq!(next(&mut frames).await, None);
        h.commit(3);
        h.emit(3);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 3);
    }

    #[tokio::test(start_paused = true)]
    async fn truncated_replay_asks_for_a_resync() {
        let mut config = slow();
        config.replay_limit = 2;
        let h = harness(&[1, 2, 3, 4, 5], config, 8);
        let mut frames = open(&h, Some(0)).await;
        next(&mut frames).await;
        next(&mut frames).await;
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 1);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 2);
        assert_eq!(next(&mut frames).await.as_deref(), Some(RESYNC));
        assert_eq!(next(&mut frames).await, None);
        // The cursor stays at the last event sent: later reads continue
        // from there, a limit at a time, and skip nothing.
        h.commit(6);
        h.emit(6);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 3);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 4);
        assert_eq!(next(&mut frames).await.as_deref(), Some(RESYNC));
        assert_eq!(next(&mut frames).await, None);
        h.emit(6);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 5);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 6);
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn lagging_behind_the_bus_catches_up_from_the_log() {
        let h = harness(&[], slow(), 2);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        // Five notices into a buffer of two: the reader misses three and
        // reads the log once, which has all five.
        for position in 1..=5 {
            h.commit(position);
            h.emit(position);
        }
        for position in 1..=5 {
            assert_eq!(id_of(&next(&mut frames).await.unwrap()), position);
        }
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn out_of_order_publication_is_delivered_in_log_order() {
        let h = harness(&[], slow(), 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        // Both committed; the later one is announced first (publication
        // runs after the commit, outside the tenant lock).
        h.commit(5);
        h.commit(6);
        h.emit(6);
        h.emit(5);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 5);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 6);
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn live_catch_up_longer_than_the_limit_asks_for_resync() {
        let mut config = slow();
        config.replay_limit = 2;
        let h = harness(&[], config, 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        for position in 1..=4 {
            h.commit(position);
        }
        h.emit(4);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 1);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 2);
        assert_eq!(next(&mut frames).await.as_deref(), Some(RESYNC));
        assert_eq!(next(&mut frames).await, None);
        h.emit(4);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 3);
        assert_eq!(id_of(&next(&mut frames).await.unwrap()), 4);
        assert_eq!(next(&mut frames).await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn a_failed_log_read_ends_the_stream() {
        let h = harness(&[], slow(), 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        *h.log.fail.lock().unwrap() = true;
        h.commit(1);
        h.emit(1);
        // Ended, not idle: the browser reconnects with `Last-Event-ID`.
        assert_eq!(frames.next().await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn keeps_alive_without_an_id_and_ends_at_max_age() {
        let config = EventsConfig {
            keep_alive_interval: Duration::from_secs(1),
            max_connection_age: Duration::from_secs(3),
            replay_limit: 500,
        };
        let h = harness(&[], config, 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        // Ticks at 1s and 2s; at 3s the deadline wins. Paused time advances
        // to the next timer on its own, so no timeout here (it would fire
        // first).
        let keep_alive = Some(Bytes::from(": keep-alive\n\n"));
        assert_eq!(frames.next().await, keep_alive);
        assert_eq!(frames.next().await, keep_alive);
        assert_eq!(frames.next().await, None);
    }

    #[tokio::test(start_paused = true)]
    async fn ends_on_shutdown() {
        let h = harness(&[], slow(), 8);
        let mut frames = open(&h, None).await;
        next(&mut frames).await;
        next(&mut frames).await;
        assert_eq!(h.bus.receiver_count(), 1);
        h.shutdown.cancel();
        assert_eq!(frames.next().await, None);
        drop(frames);
        assert_eq!(h.bus.receiver_count(), 0);
    }
}
