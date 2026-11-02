//! Redis pub/sub as the transport between instances.
//!
//! Publishing is fire-and-forget on Redis's side (a subscriber that is not
//! connected misses the message), which is fine: the message is a wake-up,
//! the truth is in `license_events` and a reconnecting stream replays from
//! there. The subscriber feeds the local [`EventBus`] and reconnects with
//! backoff when the connection drops; the publisher uses a
//! `ConnectionManager`, which reconnects on its own.

use std::time::Duration;

use async_trait::async_trait;
use errx::{AppError, AppResult};
use futures_util::StreamExt;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use tokio::sync::OnceCell;
use tokio_util::sync::CancellationToken;

use crate::events::bus::EventBus;
use crate::events::REDIS_CHANNEL;
use crate::license::port::EventPublisher;
use crate::license::LicenseChanged;

const MIN_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

/// `PUBLISH`es every event on [`REDIS_CHANNEL`] as JSON.
pub struct RedisPublisher {
    client: Client,
    conn: OnceCell<ConnectionManager>,
}

impl RedisPublisher {
    /// `client` is lazy; the connection is opened on the first publish.
    pub fn new(client: Client) -> Self {
        Self {
            client,
            conn: OnceCell::new(),
        }
    }

    async fn connection(&self) -> AppResult<ConnectionManager> {
        let conn = self
            .conn
            .get_or_try_init(|| self.client.get_connection_manager())
            .await
            .map_err(|e| AppError::internal(format!("redis connection failed: {e}")))?;
        Ok(conn.clone())
    }
}

#[async_trait]
impl EventPublisher for RedisPublisher {
    async fn publish(&self, event: LicenseChanged) -> AppResult<()> {
        let payload = serde_json::to_string(&event).map_err(|e| AppError::internal(format!("event encoding: {e}")))?;
        let mut conn = self.connection().await?;
        let _subscribers: i64 = conn
            .publish(REDIS_CHANNEL, payload)
            .await
            .map_err(|e| AppError::internal(format!("redis publish failed: {e}")))?;
        Ok(())
    }
}

/// Feeds `bus` with every event published on the channel until `cancel`.
/// A dropped connection is retried with exponential backoff (1 s to 30 s),
/// reset once a subscription is up again.
pub async fn subscribe_forever(client: Client, bus: EventBus, cancel: CancellationToken) {
    let mut backoff = MIN_BACKOFF;
    loop {
        tokio::select! {
            _ = cancel.cancelled() => break,
            outcome = relay(&client, &bus) => match outcome {
                Ok(()) => {
                    tracing::warn!("redis subscription ended; reconnecting");
                    backoff = MIN_BACKOFF;
                }
                Err(error) => {
                    tracing::warn!(error = %error, retry_in = ?backoff, "redis subscription failed; reconnecting");
                }
            },
        }
        tokio::select! {
            _ = cancel.cancelled() => break,
            _ = tokio::time::sleep(backoff) => {}
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
    tracing::info!("redis subscriber stopped");
}

/// One subscription: runs until the connection drops.
async fn relay(client: &Client, bus: &EventBus) -> redis::RedisResult<()> {
    let mut pubsub = client.get_async_pubsub().await?;
    pubsub.subscribe(REDIS_CHANNEL).await?;
    tracing::info!(channel = REDIS_CHANNEL, "redis subscriber connected");
    let mut messages = pubsub.into_on_message();
    while let Some(message) = messages.next().await {
        match serde_json::from_slice::<LicenseChanged>(message.get_payload_bytes()) {
            Ok(event) => bus.emit(event),
            Err(error) => tracing::warn!(error = %error, "ignoring malformed event on the redis channel"),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use tokio::time::timeout;

    use super::*;
    use crate::license::EventSource;
    use crate::testing::changed;

    /// Needs a Redis server: `REDIS_URL=redis://localhost:6379 cargo test -- --include-ignored`.
    #[tokio::test]
    #[ignore = "needs REDIS_URL"]
    async fn events_round_trip_through_the_channel() {
        let url = std::env::var("REDIS_URL").expect("REDIS_URL must point at a Redis server (redis://host:port)");
        let client = Client::open(url).unwrap();
        let bus = EventBus::new(8);
        let cancel = CancellationToken::new();
        let subscriber = tokio::spawn(subscribe_forever(client.clone(), bus.clone(), cancel.clone()));
        let mut rx = bus.subscribe();

        let publisher = RedisPublisher::new(client);
        let mut event = changed(7);
        event.source = EventSource::System;
        // The subscriber connects in the background; publish until it hears us.
        let mut received = None;
        for _ in 0..50 {
            publisher.publish(event.clone()).await.unwrap();
            if let Ok(Ok(got)) = timeout(Duration::from_millis(200), rx.recv()).await {
                received = Some(got);
                break;
            }
        }
        assert_eq!(received.as_ref(), Some(&event));

        cancel.cancel();
        timeout(Duration::from_secs(5), subscriber).await.unwrap().unwrap();
    }
}
