//! Real-time delivery of license changes over Server-Sent Events.
//!
//! `GET /api/v1/events` streams one `license.changed` event per committed
//! transition of the caller's tenant, each carrying the track as it reads
//! after the change, so the UI replaces the row without another request.
//! The transport is SSE because the flow is one-directional, the browser's
//! `EventSource` reconnects on its own and sends `Last-Event-ID` back, and
//! plain HTTP proxies pass it through. Authentication is the access cookie
//! (`EventSource` cannot set headers); the Bearer header still works for
//! curl and tests.
//!
//! Inside the process a [`bus::EventBus`] (a `tokio::sync::broadcast`
//! channel) fans events out to every open stream. Alone it serves a single
//! instance; with `REDIS_URL` set, transitions are published to a Redis
//! channel and a background subscriber on every instance feeds its local
//! bus, so clients of any instance see every change. Neither the channel
//! nor the bus carries the stream: both are wake-ups. `license_events` is
//! the source of truth through its tenant-wide `position` (the SSE `id`):
//! whenever the bus says the log grew, a stream reads the table after the
//! last position it sent, so events reach the client in commit order
//! whatever the order of publication, and a client that reconnects with
//! `Last-Event-ID` gets what it missed the same way. A `resync` event tells
//! it to reload when one read is longer than the limit. `docs/licensing.md`
//! records the research behind the shape.

pub mod bus;
pub mod service;
pub mod sse;
pub mod infra {
    pub mod redis;
}
pub mod api {
    pub mod handlers;
}

use std::time::Duration;

/// SSE event name of a committed transition.
pub const EVENT_LICENSE_CHANGED: &str = "license.changed";
/// SSE event name telling the client to reload its lists: more than
/// `replay_limit` events were pending in one read (`replay_truncated`).
pub const EVENT_RESYNC: &str = "resync";
/// Reconnection delay advertised to the browser at the start of a stream.
pub const RETRY: Duration = Duration::from_secs(3);
/// Notices the in-process bus retains for slow readers (per process).
/// Falling behind it costs a stream one bigger read of the log, never an
/// event.
pub const EVENT_BUFFER: usize = 256;
/// Redis pub/sub channel every instance publishes to and subscribes from.
pub const REDIS_CHANNEL: &str = "licensing.license_changed";

/// Settings of the stream.
#[derive(Debug, Clone)]
pub struct EventsConfig {
    /// Period of the comment lines that keep idle connections open through
    /// proxies (the spec suggests about 15 seconds).
    pub keep_alive_interval: Duration,
    /// A stream is closed after this long; the browser reconnects at once
    /// with the current cookie, which re-authenticates the session (the
    /// context captured at connect time would otherwise outlive the token).
    pub max_connection_age: Duration,
    /// Upper bound of events one read of the log delivers, on reconnect or
    /// live, before `resync` is sent.
    pub replay_limit: i64,
}

impl Default for EventsConfig {
    fn default() -> Self {
        Self {
            keep_alive_interval: Duration::from_secs(15),
            max_connection_age: Duration::from_secs(15 * 60),
            replay_limit: 500,
        }
    }
}
