# 2. Server-Sent Events, fanned out on Tokio

Date: 2026-08-21

Status: Accepted

## Context

Track changes must reach interested clients in near real time. The workflow is
collaborative: several people work a movie's tracks at once, and a music
supervisor watching a scene should see a state move to `licensed` without
polling for it.

The transport question and the runtime question are one question. A live update
feature is a decision about **how many things the process holds open at once**,
what each of those costs, and what happens when one of them cannot keep up. In
an async Rust service those are decisions about tasks, channels, and
cancellation — not about HTTP.

Three constraints shaped everything below:

1. **A connection is a scarce resource.** PostgreSQL has a bounded connection
   count, and so does the pool in front of it.
2. **A slow client must not be able to grow the server's memory.** Anything
   unbounded between the writer and the reader is a memory leak with extra
   steps.
3. **A client must never be silently wrong.** Live delivery that quietly skips
   an update is worse than no live delivery, because the client cannot tell.

## Decision

Server-Sent Events over `GET /movies/{id}/track-events` and
`GET /scenes/{id}/track-events`, fed by PostgreSQL `LISTEN`/`NOTIFY` through a
single process-wide fan-out built on Tokio primitives.

### Why SSE

SSE is one-directional server-to-client over ordinary HTTP protocol. That
matches the domain exactly — clients mutate through REST and only *observe*
through the stream, so a bidirectional transport would be capability nobody
uses. It also keeps the existing bearer-token middleware, problem+json error
bodies, and observability stack unchanged, where WebSockets would need a
separate authentication and error path after the protocol upgrade.

The cost is accepted explicitly: the browser's native `EventSource` cannot set
an `Authorization` header, so clients need a fetch-based SSE reader. Putting the
token in the query string was rejected — URLs land in access logs, proxy logs,
and browser history, and a bearer token is a credential.

### One listener task, not one per stream

```text
write txn ── pg_notify ──┐
                         ▼
                 PgListener (1 connection, 1 tokio task)
                         │
                         ▼
              broadcast::Sender<StreamSignal>
                    ╱    │    ╲
              stream  stream  stream        ← one per connected client

one Arc<TrackChangeNotification>, cloned per receiver — a refcount bump, not a copy
```

The alternative — each SSE handler opening its own `LISTEN` connection — fails
constraint 1 immediately. `LISTEN` holds its connection for the lifetime of the
subscription, so a thousand streams would want a thousand permanently-held
PostgreSQL connections. The fan-out decouples the two counts entirely: **client
count no longer touches database connection count.**

For the same reason the listener's connection is opened directly rather than
taken from the request pool. A pool that permanently lends out one connection is
a pool one connection smaller, and that is a bug that only shows up under load.

`event_listener::spawn` returns a `JoinHandle<()>` that the server keeps, so the
task has an owner and a defined end, rather than being fire-and-forget.

### Concurrency, not parallelism

This is the part worth being precise about, because the two words are often used
interchangeably and the design depends on the difference.

A thousand open SSE streams are a thousand **concurrent** operations. They are
not a thousand parallel ones, and they must not be a thousand threads: each OS
thread costs a stack measured in megabytes, and a stream that is idle between
heartbeats would be a thread doing nothing but holding memory.

```text
   concurrency — how many are in flight        parallelism — how many run at once
   ────────────────────────────────────        ─────────────────────────────────
     stream task    #1  ─┐
     stream task    #2  ─┤
     stream task    #3  ─┼──►  Tokio scheduler  ──►   worker 0    worker 1
          ...           ─┤      (work-stealing)       worker 2    worker 3
     stream task #1000  ─┤                            └─── one per core ───┘
     listener task      ─┘

     1001 heap-allocated state machines,             4 OS threads,
     each parked at an .await until it has work      ~2 MB of stack each

     one blocking call in any task ──► that worker is gone; four ──► the server is
```

Instead each stream is an async state machine that occupies a worker thread only
while it has something to do — which, for a stream between events, is
microseconds per minute. `#[tokio::main]` starts the multi-threaded work-stealing
runtime, so the small pool of worker threads (one per core by default) provides
whatever **parallelism** the machine has, and Tokio multiplexes the concurrent
streams across it.

The corollary is a rule this code has to keep: **no blocking call in an async
task.** A blocking operation does not park a task, it parks the worker thread
running it, and with N workers, N blocking calls stop the entire server. Every
operation on this path is I/O-bound and async — `sqlx` queries, channel receives,
timers. There is no CPU-heavy step here, so no `spawn_blocking` is needed; the
notification payload is serialized once on the write path rather than once per
connected client, which keeps it that way.

### `broadcast` for fan-out, and the bounded-channel decision

`tokio::sync::broadcast` is multi-producer, multi-consumer: every subscriber
receives every message. Each open stream calls `subscribe()` and gets its own
`Receiver` with its own cursor into a shared ring buffer.

The channel is **bounded** at 1024 messages, which is the direct answer to
constraint 2. An unbounded channel would let one slow client accumulate an
unbounded backlog in server memory. A bounded one cannot, but that forces a
question the unbounded version lets you ignore: what happens to a subscriber
that falls 1024 messages behind?

`broadcast` answers it in a way that suits this domain exactly. It does not block
the sender and it does not silently drop — the slow receiver's next `recv()`
returns `Err(RecvError::Lagged(n))`, telling it precisely how many messages it
missed. That turns constraint 3 from a hope into a signal the code can act on,
and the stream **closes** on it:

```rust
Step::Signal(Err(RecvError::Lagged(missed))) => {
    // Skipping ahead would leave the client silently wrong about
    // tracks it never saw change, so the stream closes instead.
    close(&state.scope, CloseReason::Lagged(missed));
    return None;
}
```

Closing is the honest outcome. The client sees its connection end, re-reads
through REST — which remains authoritative — and resubscribes. A stream that
resumed after a gap would leave it rendering stale tracks with no way to know.

Messages are `StreamSignal::Changed(Arc<TrackChangeNotification>)`. `broadcast`
clones the value once per receiver, so the payload sits behind an `Arc`: cloning
is a reference-count bump rather than a deep copy of the notification and its
embedded track representation. Shared, immutable, read by many tasks at once —
the case `Arc` exists for.

### `watch` for shutdown, and why not `broadcast`

Shutdown deliberately uses a *different* primitive:

```rust
/// Flipped once, at shutdown. A `watch` rather than a `broadcast` so a
/// stream that has already lagged still observes it.
shutdown: watch::Sender<bool>,
```

`tokio::sync::watch` holds one latest value rather than a queue. A receiver
always observes the current state, so it **cannot lag**. If shutdown travelled
on the `broadcast` channel, a subscriber that had already fallen behind could
miss the shutdown message — exactly the subscriber most in need of being told to
stop. Same fan-out shape, different failure mode, and the failure mode is what
picks the primitive.

### `Semaphore` for the connection cap, released by `Drop`

`sse_max_connections` (default 1000) is enforced with a `tokio::sync::Semaphore`.
The handler calls `try_acquire_owned()`, which is **non-blocking**: at capacity
it returns immediately and the request gets `503` with `Retry-After`, rather than
queueing behind a permit it may wait arbitrarily long for. A client is told the
truth now instead of being held open on a promise.

The permit is then stored in the stream's state as `_permit` and never touched
again. That is deliberate — it ties the permit to the stream's lifetime through
ownership, so the slot is returned when the stream is dropped, whatever ends it:
an orderly close, a lagged close, shutdown, or the client simply disconnecting
and axum dropping the response body. RAII, across an async boundary, with no
cleanup path to forget.

`listener_status` is an `AtomicBool` with `Acquire`/`Release` ordering rather
than a `Mutex`. It is read on every stream open and written only on connect and
disconnect; a lock-free load is both cheaper and impossible to hold across an
`await` point by accident.

### `select!`, bias, and cancellation safety

Each stream's loop waits on three things at once, and every branch either emits
one item or ends the stream:

```text
one stream = StreamState { scope, signals, shutdown, heartbeat, _permit }
                                                                └── dropped with the
   ┌───────────────── select! { biased; } ─────────────────┐        stream; permit
   │                                                       │        returns to the
   │  1. shutdown.changed() ──────────────────► close      │        Semaphore
   │  2. signals.recv() ── Changed ─► in scope? ─► emit    │
   │                    ── Lagged  ─────────────► close    │
   │                    ── Reset   ─────────────► close    │
   │  3. heartbeat.tick() ────────────────────► emit `:`   │
   └───────────────────────────────────────────────────────┘
   every pass drops the futures of the branches that did not win
   → each one must be cancel-safe
```

```rust
tokio::select! {
    // Shutdown wins: a closing server should not spend its grace
    // period forwarding events.
    biased;
    changed = shutdown.changed() => ...,
    signal  = signals.recv()     => ...,
    _       = heartbeat.tick()   => ...,
}
```

`biased;` replaces `select!`'s default random polling order with top-to-bottom.
Random order exists to prevent starvation between equally-important branches;
here the branches are not equal, and a deterministic order is what makes
"shutdown takes precedence" true rather than probable. It also makes the loop
deterministic under test.

`select!` **drops the futures of the branches that did not complete** on every
pass. That makes cancellation safety a correctness requirement, not a detail:
each branch's future must be droppable mid-flight without losing state.
`broadcast::Receiver::recv`, `watch::Receiver::changed`, and `Interval::tick` all
are — the receiver's cursor and the timer's schedule live in the receiver, not in
the future. The one place where cancellation *does* lose something is documented
where it happens, in the listener loop:

```rust
// Cancelling `try_recv` at shutdown may discard a buffered
// notification. That is acceptable: the streams it would have gone
// to are closing anyway.
```

The listener also uses `try_recv()` rather than `recv()` on `PgListener`, because
`recv()` reconnects transparently. A silent reconnection is a silent gap in
delivery — precisely what constraint 3 forbids. `try_recv()` surfaces the lost
connection as `Ok(None)`, which becomes a `ListenerReset` that closes every open
stream.

One borrow-checker detail is load-bearing enough to keep: the three futures are
built from fields destructured out of the state struct rather than from the
struct itself, because awaiting them together would otherwise require two
simultaneous mutable borrows of the whole state.

### `stream::unfold` instead of a hand-written `Stream`

axum's `Sse` wants a `Stream`. Implementing `Stream` by hand means writing
`poll_next` against `Pin<&mut Self>` and `Poll`, and hand-rolling the state
machine that `async` would otherwise generate.

`futures::stream::unfold` takes a state value and an `async fn(State) ->
Option<(Item, State)>` and produces the `Stream`, so the per-stream logic is
written as ordinary sequential async code that returns `None` to close. All the
per-connection state — scope, receivers, heartbeat timer, semaphore permit — is
owned by that state struct and dropped with it.

The item type is `Result<Event, Infallible>`: this stream has no error path to
express, because every failure mode ends the stream instead of emitting an error
event.

### Heartbeats, with the timer configured for the real failure mode

Idle connections get closed by proxies and load balancers, so each stream emits
an SSE comment every 15 seconds. Two `Interval` details are set deliberately:

- `interval_at(Instant::now() + interval, interval)` anchors the first tick one
  full period out. A plain `interval()` fires immediately, so every client would
  receive a heartbeat as its first bytes rather than a real change.
- `set_missed_tick_behavior(MissedTickBehavior::Delay)` — the default is `Burst`,
  which fires all missed ticks back-to-back to catch up. A stream that was not
  polled for a minute would emit a burst of heartbeats at once. `Delay` schedules
  the next tick a full period after the late one, which is what an
  idle-connection keepalive actually wants.

### The notification crosses the transaction boundary correctly

`pg_notify` is called **inside** the write transaction, as the last statement
before `COMMIT`. PostgreSQL queues a notification and delivers it only if the
transaction commits, so a rolled-back change notifies nobody, and a subscriber
never learns of a change before a REST read would show it. Atomicity of the
track, its event, and its notification is one transaction, not three steps and a
hope.

The payload carries the complete current track representation, guarded by a
7500-byte check against PostgreSQL's 8000-byte notification limit. That is what
lets the SSE handlers touch no database at all: a burst of writes costs one
query on the write path, not one per connected client. Oversize payloads degrade
delivery rather than failing the write, since the change itself is valid.

### Reconnection

The listener task reconnects with exponential backoff bounded at 5 seconds,
starting at 250ms. Bounded on both ends on purpose: unbounded growth would make
recovery from a brief blip take minutes, and no backoff at all would turn a
database outage into a reconnection storm against a database already in trouble.

While reconnecting, new stream requests are rejected with `503`. Handing a client
a connection that silently delivers nothing would be the same failure constraint
3 rules out, just at open time.

### Shutdown ordering

Graceful shutdown has a subtlety specific to long-lived streams: axum's
`with_graceful_shutdown` waits for in-flight connections to finish, and an SSE
stream is designed never to finish. Waiting on it means waiting forever.

So the streams are closed *explicitly*, first:

1. SIGTERM or Ctrl-C fires.
2. `EventStreams::shutdown()` flips the `watch`, and every stream's `select!`
   takes its shutdown branch and returns `None`.
3. A `oneshot` channel reports the signal back out of the shutdown future, so
   the 10-second grace period is measured **from the signal**, not from startup.
4. The listener task observes the same flag and releases its connection, with a
   2-second timeout.
5. The pool is drained last, so in-flight transactions finish before exit.

## Consequences

- Client count is decoupled from database connection count. Scaling streams is a
  memory and file-descriptor question, not a PostgreSQL one.
- A `NOTIFY` reaches only the process that received it. With more than one
  instance behind a load balancer, each holds its own listener — which works,
  because every instance is listening to the same database. What does *not*
  survive multiple instances is the `sse_max_connections` cap, which is per
  process.
- Delivery is best-effort while connected: no replay, no cursor, no recovery of
  what a disconnected client missed. Clients must load state through REST and
  subscribe for what follows. This is a real limitation and it is the reason
  streams close loudly on degradation.
- No `id:` field is emitted. The event id travels in the payload for correlation
  with history, deliberately not as a resumable cursor, since there is nothing to
  resume from.
- The `Lagged`-closes-the-stream rule means a client on a slow link may be
  disconnected repeatedly under heavy write load. That is the intended trade
  against showing it a state it cannot trust.
- A unit test asserts the streamed track's JSON is identical to
  `TrackWithSongDto`, so the two representations cannot drift apart silently.

## Alternatives considered

- **WebSockets** — rejected: bidirectional capability nothing uses, at the cost
  of a second authentication and error-handling path after the protocol upgrade.
  The right choice if clients ever mutate over the socket.
- **Polling** — rejected: latency and constant load proportional to client count,
  against a workflow where most tracks change rarely.
- **Redis pub/sub or a message broker** — rejected as scope: `LISTEN`/`NOTIFY`
  needs no additional infrastructure and gives transactional coupling for free.
  Worth revisiting if delivery ever needs to outlive a client's connection, which
  is the thing `NOTIFY` fundamentally cannot do.

## References

- [WHATWG HTML — Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [PostgreSQL — NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [Tokio — `sync::broadcast`](https://docs.rs/tokio/latest/tokio/sync/broadcast/index.html)
- [Tokio — `sync::watch`](https://docs.rs/tokio/latest/tokio/sync/watch/index.html)
- [Tokio — `select!` and cancellation safety](https://docs.rs/tokio/latest/tokio/macro.select.html)
- [Tokio — `MissedTickBehavior`](https://docs.rs/tokio/latest/tokio/time/enum.MissedTickBehavior.html)
- [Tokio — Bridging with sync code / blocking in async](https://tokio.rs/tokio/topics/bridging)
- [Alice Ryhl — Async: What is blocking?](https://ryhl.io/blog/async-what-is-blocking/)
- [`futures::stream::unfold`](https://docs.rs/futures/latest/futures/stream/fn.unfold.html)
