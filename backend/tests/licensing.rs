//! Licensing transitions, idempotent PUT semantics, and optimistic concurrency.

mod common;

use axum::http::{header, Request, StatusCode};
use common::{default_token, get, seeded_database, send, send_to, TestDatabase};
use music_licensing_api::infrastructure::seed;
use serde_json::{json, Value};
use uuid::Uuid;

fn scene_id() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/arrival")
}

fn song_id() -> Uuid {
    seed::seed_id("song", "amber-lights")
}

/// Creates a track and returns its id, which starts `pending` at version 1.
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
                    "scene_id": scene_id(),
                    "song_id": song_id(),
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

fn state_request(
    track_id: Uuid,
    state: &str,
    expected_version: i32,
    token: &str,
) -> Request<axum::body::Body> {
    Request::builder()
        .method("PUT")
        .uri(format!("/tracks/{track_id}/licensing-state"))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(axum::body::Body::from(
            json!({
                "licensing_state": state,
                "expected_version": expected_version,
            })
            .to_string(),
        ))
        .unwrap()
}

async fn set_state(
    database: &TestDatabase,
    track_id: Uuid,
    state: &str,
    expected_version: i32,
) -> (StatusCode, Value) {
    let token = default_token(database).await;
    let (status, _, body) = send(
        database,
        state_request(track_id, state, expected_version, &token),
    )
    .await;
    (status, body)
}

/// Drives a track to `in_negotiation`, returning its new version.
async fn open_negotiation(database: &TestDatabase, track_id: Uuid) -> i32 {
    let (status, body) = set_state(database, track_id, "in_negotiation", 1).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["version"].as_i64().unwrap() as i32
}

async fn event_count(database: &TestDatabase, track_id: Uuid) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM track_events WHERE track_id = $1")
        .bind(track_id)
        .fetch_one(&database.pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn a_valid_transition_bumps_the_version_and_writes_one_event() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, body) = set_state(&database, track_id, "in_negotiation", 1).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["licensing_state"], "in_negotiation");
    assert_eq!(
        body["version"], 2,
        "a material change increments the version"
    );
    assert_eq!(
        event_count(&database, track_id).await,
        2,
        "creation + change"
    );

    let (event_type, payload, track_version) = sqlx::query_as::<_, (String, Value, i32)>(
        "SELECT event_type, payload, track_version
         FROM track_events WHERE track_id = $1 ORDER BY id DESC LIMIT 1",
    )
    .bind(track_id)
    .fetch_one(&database.pool)
    .await
    .unwrap();

    assert_eq!(event_type, "licensing_state_changed");
    assert_eq!(
        track_version, 2,
        "the event records the version it produced"
    );
    assert_eq!(payload["from_licensing_state"], "pending");
    assert_eq!(payload["to_licensing_state"], "in_negotiation");
    assert_eq!(payload["payload_schema_version"], 1);
}

#[tokio::test]
async fn the_full_happy_path_reaches_licensed() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let version = open_negotiation(&database, track_id).await;
    let (status, body) = set_state(&database, track_id, "licensed", version).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["licensing_state"], "licensed");
    assert_eq!(body["version"], 3);
}

#[tokio::test]
async fn pending_cannot_jump_straight_to_an_outcome() {
    let database = seeded_database().await;

    // Licensing or rejecting without a negotiation would record an outcome
    // that never happened.
    for target in ["licensed", "rejected"] {
        let track_id = create_track(&database).await;

        let (status, body) = set_state(&database, track_id, target, 1).await;

        assert_eq!(
            status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "pending -> {target}"
        );
        assert_eq!(body["code"], "invalid_state_transition");
        assert!(
            body["detail"].as_str().unwrap().contains("in_negotiation"),
            "the error should name what is allowed: {}",
            body["detail"]
        );

        // A rejected transition must leave no trace.
        assert_eq!(event_count(&database, track_id).await, 1);
        let (_, track) = get(&database, &format!("/tracks/{track_id}")).await;
        assert_eq!(track["version"], 1);
        assert_eq!(track["licensing_state"], "pending");
    }
}

#[tokio::test]
async fn pending_may_be_cancelled_directly() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, body) = set_state(&database, track_id, "cancelled", 1).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["licensing_state"], "cancelled");
}

#[tokio::test]
async fn terminal_states_cannot_be_moved_through_this_endpoint() {
    let database = seeded_database().await;

    for terminal in ["licensed", "rejected", "cancelled"] {
        let track_id = create_track(&database).await;

        // Reach the terminal state legitimately.
        let version = if terminal == "cancelled" {
            let (status, body) = set_state(&database, track_id, "cancelled", 1).await;
            assert_eq!(status, StatusCode::OK);
            body["version"].as_i64().unwrap() as i32
        } else {
            let version = open_negotiation(&database, track_id).await;
            let (status, body) = set_state(&database, track_id, terminal, version).await;
            assert_eq!(status, StatusCode::OK, "{body}");
            body["version"].as_i64().unwrap() as i32
        };

        for target in [
            "pending",
            "in_negotiation",
            "licensed",
            "rejected",
            "cancelled",
        ] {
            if target == terminal {
                continue; // self-assignment is a no-op, tested separately
            }

            let (status, body) = set_state(&database, track_id, target, version).await;

            assert_eq!(
                status,
                StatusCode::UNPROCESSABLE_ENTITY,
                "{terminal} -> {target}"
            );
            assert_eq!(body["code"], "invalid_state_transition");
            assert!(
                body["detail"].as_str().unwrap().contains("terminal"),
                "the error should say the state is terminal: {}",
                body["detail"]
            );
        }
    }
}

#[tokio::test]
async fn repeating_a_successful_request_changes_nothing() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (first_status, first) = set_state(&database, track_id, "in_negotiation", 1).await;
    assert_eq!(first_status, StatusCode::OK);

    // The natural retry: same body, same stale expected_version.
    let (second_status, second) = set_state(&database, track_id, "in_negotiation", 1).await;

    assert_eq!(
        second_status,
        StatusCode::OK,
        "a retry whose result already holds must succeed, not conflict"
    );
    assert_eq!(second["version"], first["version"], "no second increment");
    assert_eq!(second["licensing_state"], "in_negotiation");
    assert_eq!(
        event_count(&database, track_id).await,
        2,
        "the retry must not write a second event"
    );
}

#[tokio::test]
async fn assigning_the_current_state_is_a_no_op_at_any_version() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    // Wildly wrong versions included: the desired result already holds, so
    // there is nothing to disagree about.
    for expected_version in [1, 2, 99, -5] {
        let (status, body) = set_state(&database, track_id, "pending", expected_version).await;

        assert_eq!(
            status,
            StatusCode::OK,
            "expected_version {expected_version}"
        );
        assert_eq!(body["version"], 1);
    }

    assert_eq!(event_count(&database, track_id).await, 1);
}

#[tokio::test]
async fn a_stale_version_with_different_intent_conflicts() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    open_negotiation(&database, track_id).await; // now at version 2

    // A client still holding version 1 asks for something else entirely.
    let (status, body) = set_state(&database, track_id, "cancelled", 1).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "version_conflict");
    assert!(
        body["detail"].as_str().unwrap().contains("version 2"),
        "the error should report the current version: {}",
        body["detail"]
    );
    assert_eq!(
        event_count(&database, track_id).await,
        2,
        "no event written"
    );
}

#[tokio::test]
async fn an_unknown_state_name_is_rejected() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    for name in ["InNegotiation", "approved", ""] {
        let (status, body) = set_state(&database, track_id, name, 1).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{name:?}");
        assert_eq!(body["code"], "validation_failed", "{name:?}");
    }
}

#[tokio::test]
async fn the_endpoint_requires_authentication() {
    let database = seeded_database().await;
    let track_id = create_track(&database).await;

    let (status, _, body) = send(
        &database,
        Request::builder()
            .method("PUT")
            .uri(format!("/tracks/{track_id}/licensing-state"))
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(
                json!({ "licensing_state": "in_negotiation", "expected_version": 1 }).to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_token");
}

#[tokio::test]
async fn an_unknown_track_is_not_found() {
    let database = seeded_database().await;

    let (status, body) = set_state(&database, Uuid::new_v4(), "in_negotiation", 1).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "resource_not_found");
}

/// The plan's critical concurrency acceptance test.
#[tokio::test]
async fn competing_commands_from_one_version_admit_exactly_one_winner() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    // Repeated because a race that resolves correctly once may still be racy.
    for attempt in 0..5 {
        let track_id = create_track(&database).await;
        let version = open_negotiation(&database, track_id).await;

        // Two different, individually valid transitions from the same version.
        let licensed = tokio::spawn({
            let router = common::router(&database);
            let token = token.clone();
            async move { send_to(router, state_request(track_id, "licensed", version, &token)).await }
        });
        let rejected = tokio::spawn({
            let router = common::router(&database);
            let token = token.clone();
            async move { send_to(router, state_request(track_id, "rejected", version, &token)).await }
        });

        let (first, _, first_body) = licensed.await.unwrap();
        let (second, _, second_body) = rejected.await.unwrap();

        let statuses = [first, second];
        let winners = statuses.iter().filter(|s| s.is_success()).count();
        let conflicts = statuses
            .iter()
            .filter(|s| **s == StatusCode::CONFLICT)
            .count();

        assert_eq!(
            winners, 1,
            "attempt {attempt}: exactly one command must commit, got {statuses:?} \
             ({first_body}, {second_body})"
        );
        assert_eq!(
            conflicts, 1,
            "attempt {attempt}: the loser must receive 409, got {statuses:?}"
        );

        // Exactly one state-change event, and the track sits at one version
        // past the negotiation.
        assert_eq!(
            event_count(&database, track_id).await,
            3,
            "attempt {attempt}: creation + negotiation + one outcome"
        );

        let (_, track) = get(&database, &format!("/tracks/{track_id}")).await;
        assert_eq!(track["version"], (version + 1) as i64);
        assert!(
            ["licensed", "rejected"].contains(&track["licensing_state"].as_str().unwrap()),
            "attempt {attempt}: the track must hold one of the two outcomes"
        );
    }
}

#[tokio::test]
async fn identical_concurrent_commands_all_succeed_but_change_the_state_once() {
    let database = seeded_database().await;
    let token = default_token(&database).await;
    let track_id = create_track(&database).await;

    // Six clients all wanting the same thing: retries of one intent, not
    // competing intents. Every one should succeed.
    let mut handles = Vec::new();
    for _ in 0..6 {
        let router = common::router(&database);
        let token = token.clone();
        handles.push(tokio::spawn(async move {
            send_to(router, state_request(track_id, "in_negotiation", 1, &token))
                .await
                .0
        }));
    }

    for handle in handles {
        assert_eq!(handle.await.unwrap(), StatusCode::OK);
    }

    assert_eq!(
        event_count(&database, track_id).await,
        2,
        "creation plus exactly one state change"
    );

    let (_, track) = get(&database, &format!("/tracks/{track_id}")).await;
    assert_eq!(track["version"], 2);
}
