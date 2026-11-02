//! The in-process fan-out: one `tokio::sync::broadcast` channel per process.
//!
//! It is both the default [`EventPublisher`] (single instance) and the hub
//! the Redis subscriber feeds when instances are many. A receiver sees only
//! what was sent after it subscribed, and a receiver that falls more than
//! the buffer behind gets `Lagged` and continues from the oldest retained
//! value: the stream turns that into a `resync` instead of pretending
//! nothing was lost.

use async_trait::async_trait;
use errx::AppResult;
use tokio::sync::broadcast;

use crate::license::port::EventPublisher;
use crate::license::LicenseChanged;

#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<LicenseChanged>,
}

impl EventBus {
    /// `capacity` is rounded up to a power of two by tokio.
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    /// Hands the event to every current subscriber. Nobody listening is not
    /// an error.
    pub fn emit(&self, event: LicenseChanged) {
        let _ = self.tx.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<LicenseChanged> {
        self.tx.subscribe()
    }

    /// Open streams on this process (for logs and tests).
    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

#[async_trait]
impl EventPublisher for EventBus {
    async fn publish(&self, event: LicenseChanged) -> AppResult<()> {
        self.emit(event);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use tokio::sync::broadcast::error::{RecvError, TryRecvError};

    use super::*;
    use crate::testing::changed;

    #[tokio::test]
    async fn subscribers_see_what_is_emitted_after_they_subscribe() {
        let bus = EventBus::new(4);
        bus.emit(changed(1));
        let mut rx = bus.subscribe();
        assert_eq!(bus.receiver_count(), 1);
        bus.publish(changed(2)).await.unwrap();
        assert_eq!(rx.recv().await.unwrap().position, 2);
        assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
    }

    #[tokio::test]
    async fn slow_readers_lag_and_continue_from_the_oldest_retained_event() {
        let bus = EventBus::new(2);
        let mut rx = bus.subscribe();
        for position in 1..=5 {
            bus.emit(changed(position));
        }
        assert!(matches!(rx.recv().await, Err(RecvError::Lagged(3))));
        assert_eq!(rx.recv().await.unwrap().position, 4);
        assert_eq!(rx.recv().await.unwrap().position, 5);
    }
}
