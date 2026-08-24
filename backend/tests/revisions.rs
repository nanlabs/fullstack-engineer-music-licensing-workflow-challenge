//! Track revision: licensing reset, relocation, and idempotent PUT semantics.

mod common;

use axum::http::{header, Request, StatusCode};
use common::{default_token, get, seeded_database, send, TestDatabase};
use music_licensing_api::infrastructure::seed;
use serde_json::{json, Value};
use uuid::Uuid;

fn arrival_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/arrival")
}

fn tram_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/tram")
}

/// A scene in a *different* movie, for the relocation boundary.
fn other_movie_scene() -> Uuid {
    seed::seed_id("scene", "neon-harbour/night-market")
}

fn amber_lights() -> Uuid {
    seed::seed_id("song", "amber-lights")
}

fn carousel() -> Uuid {
    seed::seed_id("song", "carousel")
}

async fn create_track(database: &TestDatabase) -> Uuid {
    let token = default_token(database).await;
    let (status, _, body) = send(
        database,
        Request::builder()
            .method("POST")
            .uri("/tracks")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(
                json!({
                    "scene_id": arrival_scene(),
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
    track_id: Uuid,
    state: &str,
    expected_version: i32,
) -> Value {
    let token = default_token(database).await;
    let (status, _, body) = send(
        database,
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

async fn revise(database: &TestDatabase, track_id: Uuid, revision: Value) -> (StatusCode, Value) {
    let token = default_token(database).await;
    let (status, _, body) = send(
        database,
        Request::builder()
            .method("PUT")
            .uri(format!("/tracks/{track_id}"))
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::from(revision.to_string()))
            .unwrap(),
    )
    .await;

    (status, body)
}

/// Drives a track into a terminal state, returning its version there.
async fn drive_to(database: &TestDatabase, track_id: Uuid, terminal: &str) -> i32 {
    match terminal {
        "cancelled" => set_state(database, track_id, "cancelled", 1).await["version"]
            .as_i64()
            .unwrap() as i32,
        "licensed" | "rejected" => {
            let version = set_state(database, track_id, "in_negotiation", 1).await["version"]
                .as_i64()
                .unwrap() as i32;
            set_state(database, track_id, terminal, version).await["version"]
                .as_i64()
                .unwrap() as i32
        }
        other => panic!("unsupported terminal state {other}"),
    }
}

async fn history(database: &TestDatabase, track_id: Uuid) -> Vec<Value> {
    let (status, body) = get(database, &format!("/tracks/{track_id}/history")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["items"].as_array().unwrap().clone()
}

#[tokio::test]
async fn revising_the_interval_resets_licensing_to_pending() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    let version = set_state(&database, track_id, "in_negotiation", 1).await["version"]
        .as_i64()
        .unwrap() as i32;

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": amber_lights(),
            "scene_start_ms": 2_000,
            "scene_end_ms": 9_000,
            "expected_version": version,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["licensing_state"], "pending",
        "a revised track needs permission for its new use"
    );
    assert_eq!(body["version"], version as i64 + 1);
    assert_eq!(body["scene_end_ms"], 9_000);
    assert_eq!(body["duration_ms"], 7_000);
}

/// The plan calls for this explicitly, per terminal state.
#[tokio::test]
async fn revising_a_licensed_track_resets_it_and_preserves_the_outcome() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    let version = drive_to(&database, track_id, "licensed").await;

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": version,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["licensing_state"], "pending",
        "changing the song starts a new licensing proposition"
    );

    let events = history(&database, track_id).await;
    let revision = events.last().unwrap();
    assert_eq!(revision["event_type"], "track_revised");
    assert_eq!(
        revision["payload"]["previous_definition"]["licensing_state"], "licensed",
        "history must still show the track was once licensed"
    );
    assert_eq!(
        revision["payload"]["previous_definition"]["song_id"],
        amber_lights().to_string(),
        "and what it was licensed for"
    );
}

#[tokio::test]
async fn revising_a_rejected_track_resets_it_and_preserves_the_outcome() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    let version = drive_to(&database, track_id, "rejected").await;

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": version,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["licensing_state"], "pending");

    let events = history(&database, track_id).await;
    assert_eq!(
        events.last().unwrap()["payload"]["previous_definition"]["licensing_state"],
        "rejected"
    );
}

#[tokio::test]
async fn revising_a_cancelled_track_revives_it_and_preserves_the_outcome() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    let version = drive_to(&database, track_id, "cancelled").await;

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": version,
        }),
    )
    .await;

    assert_eq!(
        status,
        StatusCode::OK,
        "revision is the documented way to revive a cancelled track: {body}"
    );
    assert_eq!(body["licensing_state"], "pending");

    let events = history(&database, track_id).await;
    assert_eq!(
        events.last().unwrap()["payload"]["previous_definition"]["licensing_state"],
        "cancelled"
    );
}

#[tokio::test]
async fn an_identical_revision_is_a_no_op() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    let version = set_state(&database, track_id, "in_negotiation", 1).await["version"]
        .as_i64()
        .unwrap() as i32;

    // The definition the track already has, submitted with a stale version.
    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": amber_lights(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": 1,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["licensing_state"], "in_negotiation",
        "a no-op revision must not reset licensing"
    );
    assert_eq!(body["version"], version as i64, "no version bump");
    assert_eq!(
        history(&database, track_id).await.len(),
        2,
        "creation + state change only"
    );
}

#[tokio::test]
async fn a_stale_version_with_a_different_definition_conflicts() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;
    set_state(&database, track_id, "in_negotiation", 1).await; // now version 2

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": 1,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "version_conflict");
    assert_eq!(
        history(&database, track_id).await.len(),
        2,
        "nothing written"
    );
}

#[tokio::test]
async fn a_track_may_be_relocated_within_its_movie() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, body) = revise(
        &database,
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

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["scene_id"], tram_scene().to_string());

    // The relocation event names both scenes, so it can reach both streams.
    let events = history(&database, track_id).await;
    let relocation = events.last().unwrap();
    assert_eq!(relocation["event_type"], "track_revised");
    assert_eq!(relocation["previous_scene_id"], arrival_scene().to_string());
    assert_eq!(relocation["new_scene_id"], tram_scene().to_string());
}

#[tokio::test]
async fn a_revision_that_stays_in_one_scene_records_no_relocation() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    revise(
        &database,
        track_id,
        json!({
            "scene_id": arrival_scene(),
            "song_id": carousel(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": 1,
        }),
    )
    .await;

    let events = history(&database, track_id).await;
    let revision = events.last().unwrap();

    assert!(
        revision.get("previous_scene_id").is_none(),
        "scene ids are only set when the track actually moved"
    );
    assert!(revision.get("new_scene_id").is_none());
}

#[tokio::test]
async fn a_track_cannot_be_relocated_into_another_movie() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": other_movie_scene(),
            "song_id": amber_lights(),
            "scene_start_ms": 1_000,
            "scene_end_ms": 5_000,
            "expected_version": 1,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "scene_outside_movie");
    assert!(
        body["detail"].as_str().unwrap().contains("new track"),
        "the error should point at the alternative: {}",
        body["detail"]
    );

    let (_, track) = get(&database, &format!("/tracks/{track_id}")).await;
    assert_eq!(track["scene_id"], arrival_scene().to_string());
    assert_eq!(track["version"], 1);
}

#[tokio::test]
async fn the_interval_is_validated_against_the_destination_scene() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    // 96,250 ms is the rooftop scene; ask for an interval that only fits the
    // longer scene the track currently sits in.
    let rooftop = seed::seed_id("scene", "midnight-in-lisbon/rooftop");

    let (status, body) = revise(
        &database,
        track_id,
        json!({
            "scene_id": rooftop,
            "song_id": amber_lights(),
            "scene_start_ms": 0,
            "scene_end_ms": 130_000,
            "expected_version": 1,
        }),
    )
    .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "track_interval_out_of_bounds");
}

#[tokio::test]
async fn an_unknown_scene_song_or_track_is_not_found() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let cases = [
        (
            "scene",
            json!({
                "scene_id": Uuid::new_v4(),
                "song_id": amber_lights(),
                "scene_start_ms": 0,
                "scene_end_ms": 1_000,
                "expected_version": 1,
            }),
            track_id,
        ),
        (
            "song",
            json!({
                "scene_id": arrival_scene(),
                "song_id": Uuid::new_v4(),
                "scene_start_ms": 0,
                "scene_end_ms": 1_000,
                "expected_version": 1,
            }),
            track_id,
        ),
        (
            "track",
            json!({
                "scene_id": arrival_scene(),
                "song_id": amber_lights(),
                "scene_start_ms": 0,
                "scene_end_ms": 1_000,
                "expected_version": 1,
            }),
            Uuid::new_v4(),
        ),
    ];

    for (label, body, target) in cases {
        let (status, response) = revise(&database, target, body).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "unknown {label}");
        assert_eq!(response["code"], "resource_not_found", "unknown {label}");
    }
}

#[tokio::test]
async fn revision_requires_authentication() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, _, body) = send(
        &database,
        Request::builder()
            .method("PUT")
            .uri(format!("/tracks/{track_id}"))
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(
                json!({
                    "scene_id": arrival_scene(),
                    "song_id": carousel(),
                    "scene_start_ms": 0,
                    "scene_end_ms": 1_000,
                    "expected_version": 1,
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_token");
}
