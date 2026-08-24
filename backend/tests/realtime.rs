//! Live delivery: `LISTEN`/`NOTIFY` fan-out, scoped SSE streams, and the
//! behaviour when delivery degrades.
//!
//! Every test drives real PostgreSQL notifications through a real
//! `PgListener`; nothing here publishes into the fan-out by hand, because the
//! part worth testing is that a committed write reaches a connected client.

mod common;

use std::sync::Arc;
use std::time::Duration;

use axum::http::{header, Request, StatusCode};
use common::{
    body_json, connected_event_streams, default_token, open_stream, router_with_events,
    seeded_database, send_to, EventStream, StreamFrame, TestDatabase,
};
use music_licensing_api::infrastructure::event_listener::EventStreams;
use music_licensing_api::infrastructure::seed;
use serde_json::{json, Value};
use uuid::Uuid;

/// How long a test waits for a change to travel through PostgreSQL, the
/// listener, and the fan-out. Generous, because it crosses a container
/// boundary; a working path takes single-digit milliseconds.
const DELIVERY_TIMEOUT: Duration = Duration::from_secs(10);

fn movie_id() -> Uuid {
    seed::seed_id("movie", "midnight-in-lisbon")
}

fn other_movie_id() -> Uuid {
    seed::seed_id("movie", "neon-harbour")
}

fn arrival_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/arrival")
}

fn tram_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/tram")
}

fn night_market_scene() -> Uuid {
    seed::seed_id("scene", "neon-harbour/night-market")
}

fn amber_lights() -> Uuid {
    seed::seed_id("song", "amber-lights")
}

fn carousel() -> Uuid {
    seed::seed_id("song", "carousel")
}

/// A database with the seed applied and a listener already connected.
async fn realtime_database(streams: EventStreams) -> (TestDatabase, Arc<EventStreams>) {
    let database = seeded_database().await;
    let events = connected_event_streams(&database, streams).await;
    (database, events)
}

async fn create_track(database: &TestDatabase, events: &Arc<EventStreams>, scene_id: Uuid) -> Uuid {
    let token = default_token(database).await;
    let (status, _, body) = send_to(
        router_with_events(database, Arc::clone(events)),
        Request::builder()
            .method("POST")
            .uri("/tracks")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(
                json!({
                    "scene_id": scene_id,
                    "song_id": amber_lights(),
                    "scene_start_ms": 1_000,
                    "scene_end_ms": 5_000,
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["id"].as_str().unwrap().parse().unwrap()
}

async fn set_state(
    database: &TestDatabase,
    events: &Arc<EventStreams>,
    track_id: Uuid,
    state: &str,
    expected_version: i32,
) -> Value {
    let token = default_token(database).await;
    let (status, _, body) = send_to(
        router_with_events(database, Arc::clone(events)),
        Request::builder()
            .method("PUT")
            .uri(format!("/tracks/{track_id}/licensing-state"))
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(
                json!({ "licensing_state": state, "expected_version": expected_version })
                    .to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{state}: {body}");
    body
}

async fn revise(
    database: &TestDatabase,
    events: &Arc<EventStreams>,
    track_id: Uuid,
    revision: Value,
) -> Value {
    let token = default_token(database).await;
    let (status, _, body) = send_to(
        router_with_events(database, Arc::clone(events)),
        Request::builder()
            .method("PUT")
            .uri(format!("/tracks/{track_id}"))
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(revision.to_string()))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

/// Opens a stream that is expected to succeed.
async fn subscribe(database: &TestDatabase, events: &Arc<EventStreams>, path: &str) -> EventStream {
    let token = default_token(database).await;
    let (status, headers, body) = open_stream(
        router_with_events(database, Arc::clone(events)),
        path,
        &token,
    )
    .await;

    assert_eq!(status, StatusCode::OK, "opening {path} failed");
    assert_eq!(
        headers.get(header::CONTENT_TYPE).unwrap(),
        "text/event-stream"
    );

    EventStream::new(body)
}

/// Reads frames until one carries data, so a heartbeat between two events does
/// not make a test about events fail.
async fn next_event(stream: &mut EventStream) -> StreamFrame {
    loop {
        let frame = stream
            .next_frame(DELIVERY_TIMEOUT)
            .await
            .expect("the stream closed before delivering an event");

        if !frame.is_comment() {
            return frame;
        }
    }
}

#[tokio::test]
async fn a_committed_change_reaches_a_connected_movie_stream() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let mut stream = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;

    let track_id = create_track(&database, &events, arrival_scene()).await;

    let frame = next_event(&mut stream).await;
    assert_eq!(frame.event_type(), Some("track_created"));

    // The payload must be complete enough to render without a follow-up read:
    // that is the whole point of putting the representation in the
    // notification rather than an identifier to go and fetch.
    let data = frame.data();
    assert_eq!(data["movie_id"], movie_id().to_string());
    assert_eq!(data["scene_ids"], json!([arrival_scene().to_string()]));
    assert!(data["event_id"].as_i64().unwrap() > 0);

    let track = &data["track"];
    assert_eq!(track["id"], track_id.to_string());
    assert_eq!(track["scene_id"], arrival_scene().to_string());
    assert_eq!(track["song_id"], amber_lights().to_string());
    assert_eq!(track["scene_start_ms"], 1_000);
    assert_eq!(track["scene_end_ms"], 5_000);
    assert_eq!(track["duration_ms"], 4_000);
    assert_eq!(track["licensing_state"], "pending");
    assert_eq!(track["version"], 1);
    assert_eq!(track["song"]["id"], amber_lights().to_string());
    assert!(track["song"]["title"].is_string());
    assert!(track["song"]["artist_name"].is_string());
    assert!(track["created_at"].is_string());
    assert!(track["updated_at"].is_string());
}

#[tokio::test]
async fn revisions_and_state_changes_carry_the_current_representation() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let track_id = create_track(&database, &events, arrival_scene()).await;

    // Subscribing after creation: the stream must not replay what it missed.
    let mut stream = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", arrival_scene()),
    )
    .await;

    set_state(&database, &events, track_id, "in_negotiation", 1).await;

    let changed = next_event(&mut stream).await;
    assert_eq!(changed.event_type(), Some("licensing_state_changed"));
    assert_eq!(changed.data()["track"]["licensing_state"], "in_negotiation");
    assert_eq!(changed.data()["track"]["version"], 2);

    revise(
        &database,
        &events,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 2_000,
            "scene_end_ms": 6_000,
            "expected_version": 2,
        }),
    )
    .await;

    let revised = next_event(&mut stream).await;
    assert_eq!(revised.event_type(), Some("track_revised"));

    let track = &revised.data()["track"];
    assert_eq!(track["song_id"], carousel().to_string());
    assert_eq!(track["scene_start_ms"], 2_000);
    assert_eq!(track["version"], 3);
    // The revision reset licensing, and the notification says so rather than
    // leaving a connected client to infer it.
    assert_eq!(track["licensing_state"], "pending");
    // The song summary tracks the new song, not the one the track was created
    // with.
    assert_ne!(track["song"]["title"], Value::Null);
}

#[tokio::test]
async fn streams_receive_only_in_scope_changes() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let mut other_movie = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", other_movie_id()),
    )
    .await;
    let mut other_scene = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", tram_scene()),
    )
    .await;
    let mut in_scope = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", arrival_scene()),
    )
    .await;

    create_track(&database, &events, arrival_scene()).await;

    // The in-scope stream proves the change was actually delivered, so the
    // silence of the other two means filtering rather than a lost
    // notification.
    let frame = next_event(&mut in_scope).await;
    assert_eq!(
        frame.data()["track"]["scene_id"],
        arrival_scene().to_string()
    );

    other_movie.expect_silent(Duration::from_millis(300)).await;
    other_scene.expect_silent(Duration::from_millis(300)).await;
}

#[tokio::test]
async fn a_relocation_reaches_the_previous_and_the_new_scene() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let track_id = create_track(&database, &events, arrival_scene()).await;

    let mut previous_scene = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", arrival_scene()),
    )
    .await;
    let mut new_scene = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", tram_scene()),
    )
    .await;

    revise(
        &database,
        &events,
        track_id,
        json!({
            "scene_id": tram_scene(),
            "song_id": amber_lights(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": 1,
        }),
    )
    .await;

    // The scene the track left needs to know it is gone, and the scene it
    // arrived in needs to know it is there.
    for stream in [&mut previous_scene, &mut new_scene] {
        let frame = next_event(stream).await;
        assert_eq!(frame.event_type(), Some("track_revised"));
        assert_eq!(frame.data()["track"]["scene_id"], tram_scene().to_string());

        let scenes = frame.data()["scene_ids"].as_array().unwrap().clone();
        assert!(scenes.contains(&json!(arrival_scene().to_string())));
        assert!(scenes.contains(&json!(tram_scene().to_string())));
    }
}

#[tokio::test]
async fn an_idle_stream_receives_heartbeats_and_no_priming_event() {
    let (database, events) = realtime_database(
        EventStreams::new(16).with_heartbeat_interval(Duration::from_millis(150)),
    )
    .await;

    // A track exists before the stream opens; a priming event or snapshot
    // would surface it here.
    create_track(&database, &events, arrival_scene()).await;

    let mut stream = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;

    for _ in 0..2 {
        let frame = stream
            .next_frame(DELIVERY_TIMEOUT)
            .await
            .expect("an idle stream must stay open");

        assert!(
            frame.is_comment(),
            "an idle stream must emit only comment heartbeats, got {:?}",
            frame.raw
        );
    }
}

#[tokio::test]
async fn a_lagging_subscriber_is_closed_rather_than_skipped_ahead() {
    // A two-slot buffer stands in for the production 1,024: the behaviour under
    // test is what happens once a subscriber falls behind, not how far behind
    // it has to fall.
    let (database, events) =
        realtime_database(EventStreams::new(16).with_channel_capacity(2)).await;

    let mut stream = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;

    // The stream's body is never polled while these commit, so its buffer
    // overflows exactly as a slow client's would.
    for _ in 0..8 {
        create_track(&database, &events, arrival_scene()).await;
    }

    // Closed, and closed *without* handing over a partial view of the changes
    // it missed.
    stream.expect_closed(DELIVERY_TIMEOUT).await;
}

#[tokio::test]
async fn losing_the_listener_closes_open_streams() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let mut stream = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;

    // Terminate the listener's backend from the server side, which is what a
    // database restart or a killed connection looks like to this process.
    let terminated: i64 = sqlx::query_scalar(
        "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity \
         WHERE pid <> pg_backend_pid() AND datname = current_database() \
           AND query ILIKE 'LISTEN%'",
    )
    .fetch_one(&database.pool)
    .await
    .expect("failed to terminate the listener connection");

    assert_eq!(terminated, 1, "expected exactly one listener connection");

    // Whatever was published while the listener was down cannot be recovered,
    // so the stream closes instead of silently continuing with a gap.
    stream.expect_closed(DELIVERY_TIMEOUT).await;
}

#[tokio::test]
async fn streams_are_unavailable_while_no_listener_is_connected() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    // `database.events` has no listener attached, which is the same state the
    // process is in while its listener reconnects.
    let (status, headers, body) = open_stream(
        router_with_events(&database, Arc::clone(&database.events)),
        &format!("/movies/{}/track-events", movie_id()),
        &token,
    )
    .await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(headers.get(header::RETRY_AFTER).unwrap(), "2");
    assert_eq!(body_json(body).await["code"], "sse_temporarily_unavailable");
}

#[tokio::test]
async fn the_connection_limit_is_enforced_per_process() {
    let (database, events) = realtime_database(EventStreams::new(1)).await;
    let token = default_token(&database).await;

    // Held open, so its permit stays taken.
    let first = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;

    let (status, headers, body) = open_stream(
        router_with_events(&database, Arc::clone(&events)),
        &format!("/scenes/{}/track-events", arrival_scene()),
        &token,
    )
    .await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(headers.get(header::RETRY_AFTER).unwrap(), "2");
    assert_eq!(
        body_json(body).await["code"],
        "sse_connection_limit_reached"
    );

    // Dropping the first stream releases its slot for the next client.
    drop(first);

    let (status, _, _) = open_stream(
        router_with_events(&database, Arc::clone(&events)),
        &format!("/scenes/{}/track-events", arrival_scene()),
        &token,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn shutdown_closes_open_streams() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let mut movie_stream = subscribe(
        &database,
        &events,
        &format!("/movies/{}/track-events", movie_id()),
    )
    .await;
    let mut scene_stream = subscribe(
        &database,
        &events,
        &format!("/scenes/{}/track-events", night_market_scene()),
    )
    .await;

    // What the server does when it receives SIGTERM, before it waits for
    // in-flight work.
    events.shutdown();

    // Both close promptly; without this, graceful shutdown would wait for
    // connections designed never to end on their own.
    movie_stream.expect_closed(Duration::from_secs(2)).await;
    scene_stream.expect_closed(Duration::from_secs(2)).await;
}

#[tokio::test]
async fn streams_are_scoped_to_resources_that_exist() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;
    let token = default_token(&database).await;

    for path in [
        format!("/movies/{}/track-events", Uuid::new_v4()),
        format!("/scenes/{}/track-events", Uuid::new_v4()),
    ] {
        let (status, _, body) = open_stream(
            router_with_events(&database, Arc::clone(&events)),
            &path,
            &token,
        )
        .await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body_json(body).await["code"], "resource_not_found");
    }
}

#[tokio::test]
async fn streams_require_a_bearer_token() {
    let (database, events) = realtime_database(EventStreams::new(16)).await;

    let (status, headers, body) = send_to(
        router_with_events(&database, Arc::clone(&events)),
        Request::builder()
            .uri(format!("/movies/{}/track-events", movie_id()))
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(headers.get(header::WWW_AUTHENTICATE).unwrap(), "Bearer");
    assert_eq!(body["code"], "invalid_token");
}
