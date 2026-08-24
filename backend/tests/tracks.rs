//! Track creation, retrieval, and atomic event persistence.

mod common;

use axum::http::{header, Request, StatusCode};
use common::{default_token, get, seeded_database, send, TestDatabase};
use music_licensing_api::infrastructure::seed;
use serde_json::{json, Value};
use uuid::Uuid;

/// The seeded scene most tests place a track in: 132,000 ms long.
fn scene_id() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/arrival")
}

const SCENE_DURATION_MS: i32 = 132_000;

fn movie_id() -> Uuid {
    seed::seed_id("movie", "midnight-in-lisbon")
}

fn song_id() -> Uuid {
    seed::seed_id("song", "amber-lights")
}

async fn post_track(database: &TestDatabase, body: Value) -> (StatusCode, Value) {
    let token = default_token(database).await;

    let (status, _, body) = send(
        database,
        Request::builder()
            .method("POST")
            .uri("/tracks")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(body.to_string()))
            .unwrap(),
    )
    .await;

    (status, body)
}

fn valid_track() -> Value {
    json!({
        "scene_id": scene_id(),
        "song_id": song_id(),
        "scene_start_ms": 1_000,
        "scene_end_ms": 5_000,
    })
}

/// Reads the event rows written for a track, oldest first.
async fn events_for(
    database: &TestDatabase,
    track_id: Uuid,
) -> Vec<(i64, String, Value, Uuid, String, i32)> {
    sqlx::query_as::<_, (i64, String, Value, Uuid, String, i32)>(
        "SELECT id, event_type, payload, actor_id, actor_name, track_version
         FROM track_events WHERE track_id = $1 ORDER BY id",
    )
    .bind(track_id)
    .fetch_all(&database.pool)
    .await
    .expect("failed to read events")
}

#[tokio::test]
async fn creates_a_track_that_starts_pending_at_version_one() {
    let database = seeded_database().await;

    let (status, body) = post_track(&database, valid_track()).await;

    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["licensing_state"], "pending");
    assert_eq!(body["version"], 1);
    assert_eq!(body["scene_id"], scene_id().to_string());
    assert_eq!(body["song_id"], song_id().to_string());
    assert_eq!(body["scene_start_ms"], 1_000);
    assert_eq!(body["scene_end_ms"], 5_000);
    assert_eq!(
        body["duration_ms"], 4_000,
        "duration is derived from the interval"
    );
}

#[tokio::test]
async fn a_created_track_can_be_read_back() {
    let database = seeded_database().await;
    let (_, created) = post_track(&database, valid_track()).await;
    let track_id = created["id"].as_str().unwrap();

    let (status, fetched) = get(&database, &format!("/tracks/{track_id}")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched, created, "GET must return what POST reported");
}

#[tokio::test]
async fn creation_writes_exactly_one_event_attributed_to_the_caller() {
    let database = seeded_database().await;

    let (_, created) = post_track(&database, valid_track()).await;
    let track_id: Uuid = created["id"].as_str().unwrap().parse().unwrap();

    let events = events_for(&database, track_id).await;

    assert_eq!(events.len(), 1, "creation must write exactly one event");
    let (_, event_type, payload, actor_id, actor_name, track_version) = &events[0];

    assert_eq!(event_type, "track_created");
    assert_eq!(*track_version, 1);
    assert_eq!(actor_name, "Test Actor");
    assert_eq!(
        actor_id.to_string(),
        music_licensing_api::domain::actor::Actor::from_display_name("Test Actor")
            .unwrap()
            .id
            .to_string(),
        "the event records the token's actor"
    );

    // Required by the database constraint and by any future consumer.
    assert_eq!(payload["payload_schema_version"], 1);
    assert_eq!(payload["definition"]["licensing_state"], "pending");
    assert_eq!(payload["definition"]["scene_start_ms"], 1_000);
}

#[tokio::test]
async fn the_event_records_the_movie_so_it_can_be_routed_by_scope() {
    let database = seeded_database().await;

    let (_, created) = post_track(&database, valid_track()).await;
    let track_id: Uuid = created["id"].as_str().unwrap().parse().unwrap();

    let stored_movie: Uuid =
        sqlx::query_scalar("SELECT movie_id FROM track_events WHERE track_id = $1")
            .bind(track_id)
            .fetch_one(&database.pool)
            .await
            .unwrap();

    assert_eq!(
        stored_movie,
        movie_id(),
        "the event must carry the scene's movie, for movie-scoped delivery"
    );
}

#[tokio::test]
async fn duplicate_tracks_are_allowed() {
    let database = seeded_database().await;

    let (first_status, first) = post_track(&database, valid_track()).await;
    let (second_status, second) = post_track(&database, valid_track()).await;

    assert_eq!(first_status, StatusCode::CREATED);
    assert_eq!(second_status, StatusCode::CREATED);
    assert_ne!(
        first["id"], second["id"],
        "the same song may be used twice in one scene for different reasons"
    );
}

#[tokio::test]
async fn an_interval_beyond_the_scene_is_rejected() {
    let database = seeded_database().await;

    let mut request = valid_track();
    request["scene_end_ms"] = json!(SCENE_DURATION_MS + 1);

    let (status, body) = post_track(&database, request).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "track_interval_out_of_bounds");
}

#[tokio::test]
async fn a_track_may_span_the_whole_scene() {
    let database = seeded_database().await;

    let mut request = valid_track();
    request["scene_start_ms"] = json!(0);
    request["scene_end_ms"] = json!(SCENE_DURATION_MS);

    let (status, body) = post_track(&database, request).await;

    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["duration_ms"], SCENE_DURATION_MS);
}

#[tokio::test]
async fn malformed_intervals_are_rejected() {
    let database = seeded_database().await;

    let cases = [
        ("negative start", -1, 5_000),
        ("zero length", 5_000, 5_000),
        ("inverted", 5_000, 1_000),
    ];

    for (label, start, end) in cases {
        let mut request = valid_track();
        request["scene_start_ms"] = json!(start);
        request["scene_end_ms"] = json!(end);

        let (status, body) = post_track(&database, request).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{label}");
        assert_eq!(body["code"], "track_interval_out_of_bounds", "{label}");
    }
}

#[tokio::test]
async fn an_unknown_scene_or_song_is_rejected_and_writes_nothing() {
    let database = seeded_database().await;

    let mut unknown_scene = valid_track();
    unknown_scene["scene_id"] = json!(Uuid::new_v4());

    let mut unknown_song = valid_track();
    unknown_song["song_id"] = json!(Uuid::new_v4());

    for (label, request) in [("scene", unknown_scene), ("song", unknown_song)] {
        let (status, body) = post_track(&database, request).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "unknown {label}");
        assert_eq!(body["code"], "resource_not_found", "unknown {label}");
    }

    // A rejected creation must leave neither a track nor an event behind.
    let tracks: i64 = sqlx::query_scalar("SELECT count(*) FROM tracks")
        .fetch_one(&database.pool)
        .await
        .unwrap();
    let events: i64 = sqlx::query_scalar("SELECT count(*) FROM track_events")
        .fetch_one(&database.pool)
        .await
        .unwrap();

    assert_eq!(tracks, 0);
    assert_eq!(events, 0);
}

#[tokio::test]
async fn a_failed_creation_rolls_back_atomically() {
    let database = seeded_database().await;

    // An interval that the domain rejects only after the scene and song rows
    // have been locked: the transaction must still leave nothing behind.
    let mut request = valid_track();
    request["scene_end_ms"] = json!(SCENE_DURATION_MS * 2);

    let (status, _) = post_track(&database, request).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);

    let tracks: i64 = sqlx::query_scalar("SELECT count(*) FROM tracks")
        .fetch_one(&database.pool)
        .await
        .unwrap();
    let events: i64 = sqlx::query_scalar("SELECT count(*) FROM track_events")
        .fetch_one(&database.pool)
        .await
        .unwrap();

    assert_eq!(tracks, 0, "no track may survive a rejected request");
    assert_eq!(events, 0, "no event may survive a rejected request");
}

#[tokio::test]
async fn creating_a_track_requires_authentication() {
    let database = seeded_database().await;

    let (status, _, body) = send(
        &database,
        Request::builder()
            .method("POST")
            .uri("/tracks")
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(valid_track().to_string()))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_token");
}

#[tokio::test]
async fn reading_a_track_requires_authentication() {
    let database = seeded_database().await;
    let (_, created) = post_track(&database, valid_track()).await;
    let track_id = created["id"].as_str().unwrap();

    let (status, _, _) =
        common::get_with_token(&database, &format!("/tracks/{track_id}"), None).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn an_unknown_track_is_not_found() {
    let database = seeded_database().await;

    let (status, body) = get(&database, &format!("/tracks/{}", Uuid::new_v4())).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "resource_not_found");
}

#[tokio::test]
async fn a_malformed_request_body_is_rejected() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    for body in [
        json!({ "scene_id": scene_id() }).to_string(), // missing fields
        json!({
            "scene_id": "not-a-uuid",
            "song_id": song_id(),
            "scene_start_ms": 0,
            "scene_end_ms": 1_000,
        })
        .to_string(),
        "not json at all".to_string(),
    ] {
        let (status, _, _) = send(
            &database,
            Request::builder()
                .method("POST")
                .uri("/tracks")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(axum::body::Body::from(body.clone()))
                .unwrap(),
        )
        .await;

        assert!(
            status.is_client_error(),
            "body {body:?} should be rejected, got {status}"
        );
    }
}

#[tokio::test]
async fn concurrent_creations_in_one_scene_all_succeed() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    // Creations take only share locks on reference rows, so they must not
    // serialise against each other or trip the lock timeout.
    let mut handles = Vec::new();
    for index in 0..8 {
        let router = common::router(&database);
        let token = token.clone();

        handles.push(tokio::spawn(async move {
            let body = json!({
                "scene_id": scene_id(),
                "song_id": song_id(),
                "scene_start_ms": index * 1_000,
                "scene_end_ms": index * 1_000 + 500,
            });

            common::send_to(
                router,
                Request::builder()
                    .method("POST")
                    .uri("/tracks")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header(header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(axum::body::Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .0
        }));
    }

    for handle in handles {
        assert_eq!(handle.await.unwrap(), StatusCode::CREATED);
    }

    let tracks: i64 = sqlx::query_scalar("SELECT count(*) FROM tracks")
        .fetch_one(&database.pool)
        .await
        .unwrap();
    let events: i64 = sqlx::query_scalar("SELECT count(*) FROM track_events")
        .fetch_one(&database.pool)
        .await
        .unwrap();

    assert_eq!(tracks, 8);
    assert_eq!(events, 8, "one event per track, no more and no fewer");
}
