//! Track collections, state filtering, and history.

mod common;

use axum::http::{header, Request, StatusCode};
use common::{default_token, drain_pages, get, get_ok, seeded_database, send, TestDatabase};
use music_licensing_api::infrastructure::seed;
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

fn movie_id() -> Uuid {
    seed::seed_id("movie", "midnight-in-lisbon")
}

fn arrival_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/arrival")
}

fn tram_scene() -> Uuid {
    seed::seed_id("scene", "midnight-in-lisbon/tram")
}

fn amber_lights() -> Uuid {
    seed::seed_id("song", "amber-lights")
}

async fn create_track_in(database: &TestDatabase, scene_id: Uuid, start_ms: i32) -> Uuid {
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
                    "scene_id": scene_id,
                    "song_id": amber_lights(),
                    "scene_start_ms": start_ms,
                    "scene_end_ms": start_ms + 500,
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["id"].as_str().unwrap().parse().unwrap()
}

async fn set_state(database: &TestDatabase, track_id: Uuid, state: &str, expected_version: i32) {
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
}

fn ids(items: &[Value]) -> Vec<String> {
    items
        .iter()
        .map(|item| item["id"].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test]
async fn a_scene_listing_embeds_the_song_summary() {
    let database = seeded_database().await;
    create_track_in(&database, arrival_scene(), 1_000).await;

    let body = get_ok(&database, &format!("/scenes/{}/tracks", arrival_scene())).await;
    let track = &body["items"][0];

    assert_eq!(track["song"]["id"], amber_lights().to_string());
    assert_eq!(track["song"]["title"], "Amber Lights");
    assert_eq!(track["song"]["artist_name"], "The Quiet Signal");

    // The track's own fields sit alongside the summary, not nested under it.
    assert_eq!(track["licensing_state"], "pending");
    assert_eq!(track["duration_ms"], 500);
    assert_eq!(track["version"], 1);
}

#[tokio::test]
async fn a_scene_listing_returns_only_that_scenes_tracks() {
    let database = seeded_database().await;
    let arrival = create_track_in(&database, arrival_scene(), 1_000).await;
    let tram = create_track_in(&database, tram_scene(), 1_000).await;

    let body = get_ok(&database, &format!("/scenes/{}/tracks", arrival_scene())).await;
    let listed = ids(body["items"].as_array().unwrap());

    assert_eq!(listed, [arrival.to_string()]);
    assert!(!listed.contains(&tram.to_string()));
}

#[tokio::test]
async fn a_movie_listing_spans_every_scene() {
    let database = seeded_database().await;
    let arrival = create_track_in(&database, arrival_scene(), 1_000).await;
    let tram = create_track_in(&database, tram_scene(), 2_000).await;

    let body = get_ok(&database, &format!("/movies/{}/tracks", movie_id())).await;
    let listed: HashSet<String> = ids(body["items"].as_array().unwrap()).into_iter().collect();

    assert!(listed.contains(&arrival.to_string()));
    assert!(listed.contains(&tram.to_string()));
    assert_eq!(listed.len(), 2);
}

#[tokio::test]
async fn a_movie_listing_excludes_other_movies() {
    let database = seeded_database().await;
    create_track_in(&database, arrival_scene(), 1_000).await;
    let elsewhere = create_track_in(
        &database,
        seed::seed_id("scene", "neon-harbour/night-market"),
        1_000,
    )
    .await;

    let body = get_ok(&database, &format!("/movies/{}/tracks", movie_id())).await;
    let listed = ids(body["items"].as_array().unwrap());

    assert_eq!(listed.len(), 1);
    assert!(!listed.contains(&elsewhere.to_string()));
}

#[tokio::test]
async fn cancelled_tracks_are_listed_by_default() {
    let database = seeded_database().await;
    let track_id = create_track_in(&database, arrival_scene(), 1_000).await;
    set_state(&database, track_id, "cancelled", 1).await;

    let body = get_ok(&database, &format!("/scenes/{}/tracks", arrival_scene())).await;

    assert_eq!(
        ids(body["items"].as_array().unwrap()),
        [track_id.to_string()],
        "a cancelled use is still part of the record"
    );
}

#[tokio::test]
async fn listings_can_be_filtered_by_state() {
    let database = seeded_database().await;

    let pending = create_track_in(&database, arrival_scene(), 1_000).await;
    let negotiating = create_track_in(&database, arrival_scene(), 2_000).await;
    set_state(&database, negotiating, "in_negotiation", 1).await;
    let cancelled = create_track_in(&database, arrival_scene(), 3_000).await;
    set_state(&database, cancelled, "cancelled", 1).await;

    let scene_path = format!("/scenes/{}/tracks", arrival_scene());

    let only_pending = get_ok(&database, &format!("{scene_path}?licensing_state=pending")).await;
    assert_eq!(
        ids(only_pending["items"].as_array().unwrap()),
        [pending.to_string()]
    );

    // Several states at once.
    let live = get_ok(
        &database,
        &format!("{scene_path}?licensing_state=pending,in_negotiation"),
    )
    .await;
    let live_ids: HashSet<String> = ids(live["items"].as_array().unwrap()).into_iter().collect();
    assert_eq!(live_ids.len(), 2);
    assert!(!live_ids.contains(&cancelled.to_string()));

    // The same filter works on the movie listing.
    let movie_filtered = get_ok(
        &database,
        &format!("/movies/{}/tracks?licensing_state=cancelled", movie_id()),
    )
    .await;
    assert_eq!(
        ids(movie_filtered["items"].as_array().unwrap()),
        [cancelled.to_string()]
    );
}

#[tokio::test]
async fn an_unknown_state_filter_is_rejected() {
    let database = seeded_database().await;

    for filter in ["approved", "pending,approved", ""] {
        let (status, body) = get(
            &database,
            &format!(
                "/scenes/{}/tracks?licensing_state={filter}",
                arrival_scene()
            ),
        )
        .await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{filter:?}");
        assert_eq!(body["code"], "validation_failed", "{filter:?}");
    }
}

#[tokio::test]
async fn listings_paginate_without_duplicates() {
    let database = seeded_database().await;
    for index in 0..7 {
        create_track_in(&database, arrival_scene(), index * 1_000).await;
    }

    let path = format!("/scenes/{}/tracks", arrival_scene());
    let full = get_ok(&database, &path).await;
    let expected = ids(full["items"].as_array().unwrap());
    assert_eq!(expected.len(), 7);

    let (paged_items, requests) = drain_pages(&database, &path, 2).await;
    let paged = ids(&paged_items);

    assert_eq!(paged, expected, "paged order must match the one-shot order");
    assert_eq!(
        paged.iter().collect::<HashSet<_>>().len(),
        paged.len(),
        "no row may appear on two pages"
    );
    assert!(requests > 1);
}

#[tokio::test]
async fn a_state_filter_survives_pagination() {
    let database = seeded_database().await;

    let mut cancelled = Vec::new();
    for index in 0..5 {
        let track_id = create_track_in(&database, arrival_scene(), index * 1_000).await;
        if index % 2 == 0 {
            set_state(&database, track_id, "cancelled", 1).await;
            cancelled.push(track_id.to_string());
        }
    }

    let (items, _) = drain_pages(
        &database,
        &format!(
            "/scenes/{}/tracks?licensing_state=cancelled",
            arrival_scene()
        ),
        1,
    )
    .await;

    assert_eq!(ids(&items), cancelled);
}

#[tokio::test]
async fn listings_of_unknown_parents_are_not_found() {
    let database = seeded_database().await;

    for path in [
        format!("/scenes/{}/tracks", Uuid::new_v4()),
        format!("/movies/{}/tracks", Uuid::new_v4()),
    ] {
        let (status, body) = get(&database, &path).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["code"], "resource_not_found", "{path}");
    }
}

#[tokio::test]
async fn an_empty_scene_lists_nothing() {
    let database = seeded_database().await;

    let body = get_ok(&database, &format!("/scenes/{}/tracks", tram_scene())).await;

    assert_eq!(body["items"].as_array().unwrap().len(), 0);
    assert!(body["next_cursor"].is_null());
}

#[tokio::test]
async fn history_reads_oldest_first_and_records_every_change() {
    let database = seeded_database().await;
    let track_id = create_track_in(&database, arrival_scene(), 1_000).await;
    set_state(&database, track_id, "in_negotiation", 1).await;
    set_state(&database, track_id, "licensed", 2).await;

    let body = get_ok(&database, &format!("/tracks/{track_id}/history")).await;
    let items = body["items"].as_array().unwrap();

    let types: Vec<&str> = items
        .iter()
        .map(|event| event["event_type"].as_str().unwrap())
        .collect();
    assert_eq!(
        types,
        [
            "track_created",
            "licensing_state_changed",
            "licensing_state_changed"
        ]
    );

    // Versions and ids both ascend with commit order.
    let versions: Vec<i64> = items
        .iter()
        .map(|event| event["track_version"].as_i64().unwrap())
        .collect();
    assert_eq!(versions, [1, 2, 3]);

    let event_ids: Vec<i64> = items
        .iter()
        .map(|event| event["id"].as_i64().unwrap())
        .collect();
    let mut sorted = event_ids.clone();
    sorted.sort_unstable();
    assert_eq!(event_ids, sorted);

    // Every entry is attributed and carries a versioned payload.
    for event in items {
        assert_eq!(event["actor_name"], "Test Actor");
        assert_eq!(event["payload"]["payload_schema_version"], 1);
        assert!(event["occurred_at"].is_string());
    }
}

#[tokio::test]
async fn history_paginates_in_order() {
    let database = seeded_database().await;
    let track_id = create_track_in(&database, arrival_scene(), 1_000).await;
    set_state(&database, track_id, "in_negotiation", 1).await;
    set_state(&database, track_id, "licensed", 2).await;

    let path = format!("/tracks/{track_id}/history");
    let full = get_ok(&database, &path).await;
    let expected: Vec<i64> = full["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["id"].as_i64().unwrap())
        .collect();

    let (paged, requests) = drain_pages(&database, &path, 1).await;
    let paged_ids: Vec<i64> = paged
        .iter()
        .map(|event| event["id"].as_i64().unwrap())
        .collect();

    assert_eq!(paged_ids, expected);
    assert_eq!(
        requests, 3,
        "three events at one per page: the lookahead row lets the final page \
         report no cursor, instead of costing an extra empty request"
    );
}

#[tokio::test]
async fn history_of_an_unknown_track_is_not_found() {
    let database = seeded_database().await;

    let (status, body) = get(&database, &format!("/tracks/{}/history", Uuid::new_v4())).await;

    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "an unknown track must not look like a track with no history"
    );
    assert_eq!(body["code"], "resource_not_found");
}

#[tokio::test]
async fn the_collections_require_authentication() {
    let database = seeded_database().await;
    let track_id = create_track_in(&database, arrival_scene(), 1_000).await;

    for path in [
        format!("/scenes/{}/tracks", arrival_scene()),
        format!("/movies/{}/tracks", movie_id()),
        format!("/tracks/{track_id}/history"),
    ] {
        let (status, _, body) = common::get_with_token(&database, &path, None).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(body["code"], "invalid_token", "{path}");
    }
}
