//! Process-wide fan-out of PostgreSQL notifications to connected SSE streams.
//!
//! Exactly one dedicated `PgListener` connection exists per process. It is not
//! taken from the request pool — a listener holds its connection open forever,
//! and a pool that lends one out permanently is a pool one connection smaller.
//! HTTP handlers never open a listener of their own; they subscribe to the
//! `tokio::sync::broadcast` channel this module feeds.
//!
//! # The guarantee, and what it is not
//!
//! Delivery is best-effort while a client is connected. There is no replay, no
//! cursor, and no recovery of what a disconnected client missed. When delivery
//! degrades — a subscriber falls behind, or the listener connection drops — the
//! affected streams are **closed** rather than quietly skipping events, so a
//! client is never shown a gap it cannot detect. REST remains the authoritative
//! view; a client that wants to be correct again re-reads it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use sqlx::postgres::PgListener;
use tokio::sync::{broadcast, watch, OwnedSemaphorePermit, Semaphore};
use tokio::task::JoinHandle;

use crate::config::DatabaseConfig;
use crate::infrastructure::notifications::{self, TrackChangeNotification};

/// Buffered notifications per subscriber before it is considered lagging.
///
/// A subscriber that falls this far behind is not skipping one update, it is
/// out of touch with the track state entirely, which is why the stream closes
/// instead of catching up.
const CHANNEL_CAPACITY: usize = 1_024;

/// Interval between SSE comment heartbeats, which keep proxies from dropping an
/// idle stream.
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);

/// Reconnection backoff bounds for the listener connection.
const INITIAL_RECONNECT_DELAY: Duration = Duration::from_millis(250);
const MAX_RECONNECT_DELAY: Duration = Duration::from_secs(5);

/// What a subscribed stream receives.
#[derive(Debug, Clone)]
pub enum StreamSignal {
    /// A committed track change, ready to forward to in-scope subscribers.
    ///
    /// Behind an `Arc` because one notification fans out to every open stream
    /// and none of them mutate it.
    Changed(Arc<TrackChangeNotification>),
    /// The listener connection was lost. Every open stream closes, because
    /// whatever was published while it was down is gone for good.
    ListenerReset,
}

/// Whether the process can currently open new streams, as the readiness probe
/// would describe it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListenerStatus {
    Connected,
    Reconnecting,
}

impl ListenerStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Connected => "connected",
            Self::Reconnecting => "reconnecting",
        }
    }
}

/// The handle handlers use to open a stream, and the listener task uses to
/// publish into one.
pub struct EventStreams {
    signals: broadcast::Sender<StreamSignal>,
    /// Flipped once, at shutdown. A `watch` rather than a `broadcast` so a
    /// stream that has already lagged still observes it.
    shutdown: watch::Sender<bool>,
    listener_connected: AtomicBool,
    /// Bounds concurrent streams per process. Each stream holds its permit for
    /// as long as its response body lives.
    permits: Arc<Semaphore>,
    heartbeat_interval: Duration,
}

impl EventStreams {
    /// Builds the handle. No listener is attached yet, so streams report
    /// themselves unavailable until [`spawn`] connects one.
    pub fn new(max_connections: usize) -> Self {
        let (signals, _) = broadcast::channel(CHANNEL_CAPACITY);
        let (shutdown, _) = watch::channel(false);

        Self {
            signals,
            shutdown,
            listener_connected: AtomicBool::new(false),
            permits: Arc::new(Semaphore::new(max_connections)),
            heartbeat_interval: HEARTBEAT_INTERVAL,
        }
    }

    /// Overrides the per-subscriber buffer. Tests use a tiny buffer to provoke
    /// the lagging-subscriber path deliberately; nothing else should.
    pub fn with_channel_capacity(mut self, capacity: usize) -> Self {
        let (signals, _) = broadcast::channel(capacity);
        self.signals = signals;
        self
    }

    /// Overrides the heartbeat interval, so a test can observe a heartbeat
    /// without waiting a quarter of a minute for one.
    pub fn with_heartbeat_interval(mut self, interval: Duration) -> Self {
        self.heartbeat_interval = interval;
        self
    }

    pub fn subscribe(&self) -> broadcast::Receiver<StreamSignal> {
        self.signals.subscribe()
    }

    pub fn shutdown_notifier(&self) -> watch::Receiver<bool> {
        self.shutdown.subscribe()
    }

    pub fn heartbeat_interval(&self) -> Duration {
        self.heartbeat_interval
    }

    pub fn listener_status(&self) -> ListenerStatus {
        if self.listener_connected.load(Ordering::Acquire) {
            ListenerStatus::Connected
        } else {
            ListenerStatus::Reconnecting
        }
    }

    /// Claims one of the connection slots, or `None` when the process is at its
    /// configured cap.
    pub fn try_acquire(&self) -> Option<OwnedSemaphorePermit> {
        Arc::clone(&self.permits).try_acquire_owned().ok()
    }

    /// Closes every open stream. Called once, when the server begins shutting
    /// down, so that long-lived streams do not hold graceful shutdown open for
    /// the whole grace period.
    pub fn shutdown(&self) {
        let _ = self.shutdown.send(true);
    }

    fn set_listener_connected(&self, connected: bool) {
        self.listener_connected.store(connected, Ordering::Release);
    }

    /// Fans a signal out. A send with no subscribers is not a failure: nobody
    /// is watching this movie right now.
    fn publish(&self, signal: StreamSignal) {
        let _ = self.signals.send(signal);
    }
}

/// Starts the dedicated listener task.
///
/// The task owns the whole connection lifecycle: connect, listen, forward, and
/// on any failure close the open streams and reconnect with bounded
/// exponential backoff. It returns only when [`EventStreams::shutdown`] is
/// called.
pub fn spawn(database: &DatabaseConfig, streams: Arc<EventStreams>) -> JoinHandle<()> {
    let url = database.url.expose().to_string();
    tokio::spawn(run(url, streams))
}

async fn run(url: String, streams: Arc<EventStreams>) {
    let mut shutdown = streams.shutdown_notifier();
    let mut delay = INITIAL_RECONNECT_DELAY;

    loop {
        if *shutdown.borrow() {
            break;
        }

        match connect(&url).await {
            Ok(listener) => {
                streams.set_listener_connected(true);
                delay = INITIAL_RECONNECT_DELAY;
                tracing::info!(channel = notifications::CHANNEL, "event listener connected");

                let outcome = forward(listener, &streams, &mut shutdown).await;

                streams.set_listener_connected(false);

                if outcome == Outcome::ShuttingDown {
                    break;
                }

                // Whatever was published while the connection was down is not
                // recoverable, so every open stream is closed rather than left
                // silently stale.
                tracing::warn!(
                    channel = notifications::CHANNEL,
                    "event listener disconnected; closing open streams"
                );
                streams.publish(StreamSignal::ListenerReset);
            }
            Err(error) => {
                streams.set_listener_connected(false);
                tracing::warn!(error = %error, "event listener could not connect");
            }
        }

        // Backoff is bounded: a database outage must not turn into a
        // reconnection storm, and must not take minutes to recover from.
        tokio::select! {
            _ = shutdown.changed() => break,
            _ = tokio::time::sleep(delay) => {}
        }
        delay = (delay * 2).min(MAX_RECONNECT_DELAY);
    }

    streams.set_listener_connected(false);
    tracing::info!("event listener stopped");
}

async fn connect(url: &str) -> Result<PgListener, sqlx::Error> {
    let mut listener = PgListener::connect(url).await?;
    listener.listen(notifications::CHANNEL).await?;
    Ok(listener)
}

#[derive(Debug, PartialEq, Eq)]
enum Outcome {
    Disconnected,
    ShuttingDown,
}

/// Forwards notifications until the connection drops or the process shuts down.
///
/// `try_recv` is used rather than `recv` because it reports a lost connection
/// as `Ok(None)` instead of silently reconnecting underneath us — silent
/// reconnection is exactly the gap this design refuses to hide from clients.
async fn forward(
    mut listener: PgListener,
    streams: &EventStreams,
    shutdown: &mut watch::Receiver<bool>,
) -> Outcome {
    loop {
        let received = tokio::select! {
            biased;
            // Cancelling `try_recv` at shutdown may discard a buffered
            // notification. That is acceptable: the streams it would have gone
            // to are closing anyway.
            _ = shutdown.changed() => return Outcome::ShuttingDown,
            received = listener.try_recv() => received,
        };

        match received {
            Ok(Some(notification)) => {
                match serde_json::from_str::<TrackChangeNotification>(notification.payload()) {
                    Ok(change) => streams.publish(StreamSignal::Changed(Arc::new(change))),
                    Err(error) => {
                        // A payload this process cannot read means a peer is
                        // writing a shape this build does not know. Dropping it is
                        // better than closing every stream over it.
                        tracing::error!(error = %error, "discarding unreadable notification payload");
                    }
                }
            }
            Ok(None) => return Outcome::Disconnected,
            Err(error) => {
                tracing::warn!(error = %error, "event listener receive failed");
                return Outcome::Disconnected;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streams_are_unavailable_until_a_listener_connects() {
        let streams = EventStreams::new(4);
        assert_eq!(streams.listener_status(), ListenerStatus::Reconnecting);

        streams.set_listener_connected(true);
        assert_eq!(streams.listener_status(), ListenerStatus::Connected);
        assert_eq!(ListenerStatus::Connected.as_str(), "connected");
    }

    #[test]
    fn the_connection_cap_hands_out_a_bounded_number_of_permits() {
        let streams = EventStreams::new(2);

        let first = streams.try_acquire().expect("first slot");
        let _second = streams.try_acquire().expect("second slot");
        assert!(streams.try_acquire().is_none(), "cap must be enforced");

        // Releasing a stream's permit frees its slot for the next client.
        drop(first);
        assert!(streams.try_acquire().is_some());
    }

    #[tokio::test]
    async fn shutdown_is_observable_by_an_already_subscribed_stream() {
        let streams = EventStreams::new(1);
        let mut notifier = streams.shutdown_notifier();

        assert!(!*notifier.borrow());
        streams.shutdown();

        notifier.changed().await.expect("shutdown is observable");
        assert!(*notifier.borrow());
    }
}
