//! Catalog endpoint and pagination tests against a real PostgreSQL container.

mod common;

use axum::http::StatusCode;
use common::{drain_pages, get, get_ok, migrated_database, seeded_database};
use music_licensing_api::infrastructure::seed;
use std::collections::HashSet;
use uuid::Uuid;

fn titles(items: &[serde_json::Value]) -> Vec<String> {
    items
        .iter()
        .map(|item| item["title"].as_str().expect("title").to_string())
        .collect()
}

fn ids(items: &[serde_json::Value]) -> Vec<String> {
    items
        .iter()
        .map(|item| item["id"].as_str().expect("id").to_string())
        .collect()
}

#[tokio::test]
async fn seeding_is_idempotent_and_deterministic() {
    let database = migrated_database().await;

    let first = seed::apply(&database.pool).await.unwrap();
    let second = seed::apply(&database.pool).await.unwrap();
    assert_eq!(first, second);

    // A re-run must converge, not duplicate.
    let movies: i64 = sqlx::query_scalar("SELECT count(*) FROM movies")
        .fetch_one(&database.pool)
        .await
        .unwrap();
    let scenes: i64 = sqlx::query_scalar("SELECT count(*) FROM scenes")
        .fetch_one(&database.pool)
        .await
        .unwrap();
    let songs: i64 = sqlx::query_scalar("SELECT count(*) FROM songs")
        .fetch_one(&database.pool)
        .await
        .unwrap();

    assert_eq!(movies, first.movies as i64);
    assert_eq!(scenes, first.scenes as i64);
    assert_eq!(songs, first.songs as i64);

    // The seeded IDs are the documented, derived ones.
    let known = seed::seed_id("movie", "midnight-in-lisbon");
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1)")
        .bind(known)
        .fetch_one(&database.pool)
        .await
        .unwrap();
    assert!(exists, "seed IDs must be derived deterministically");
}

#[tokio::test]
async fn movies_are_listed_in_creation_order() {
    let database = seeded_database().await;

    let body = get_ok(&database, "/movies").await;
    let items = body["items"].as_array().unwrap();

    assert_eq!(
        titles(items),
        ["Midnight in Lisbon", "The Last Rehearsal", "Neon Harbour"],
        "movies must be ordered by (created_at, id), not alphabetically"
    );
    assert!(body["next_cursor"].is_null());
}

#[tokio::test]
async fn scenes_are_listed_in_story_order() {
    let database = seeded_database().await;
    let movie_id = seed::seed_id("movie", "neon-harbour");

    let body = get_ok(&database, &format!("/movies/{movie_id}/scenes")).await;
    let items = body["items"].as_array().unwrap();

    assert_eq!(
        titles(items),
        ["Night Market", "Last Ferry Out", "End Credits"],
        "scenes must be ordered by sequence_number"
    );
    for (index, item) in items.iter().enumerate() {
        assert_eq!(item["sequence_number"], (index + 1) as i64);
        assert_eq!(item["movie_id"], movie_id.to_string());
    }
}

#[tokio::test]
async fn songs_are_listed_in_title_order() {
    let database = seeded_database().await;

    let body = get_ok(&database, "/songs").await;
    let items = body["items"].as_array().unwrap();
    let listed = titles(items);

    let mut sorted = listed.clone();
    sorted.sort();
    assert_eq!(listed, sorted, "songs must be ordered by (title, id)");
    assert_eq!(items[0]["artist_name"], "The Quiet Signal");
}

#[tokio::test]
async fn pagination_covers_every_row_exactly_once() {
    let database = seeded_database().await;

    for (path, limit) in [("/movies", 2), ("/songs", 3)] {
        let full = get_ok(&database, path).await;
        let expected = ids(full["items"].as_array().unwrap());

        let (paged_items, requests) = drain_pages(&database, path, limit).await;
        let paged = ids(&paged_items);

        assert_eq!(
            paged, expected,
            "{path}: paged order must match one-shot order"
        );

        let unique: HashSet<_> = paged.iter().collect();
        assert_eq!(
            unique.len(),
            paged.len(),
            "{path}: duplicate rows across pages"
        );

        assert!(
            requests > 1,
            "{path}: limit {limit} should have needed several pages"
        );
    }
}

#[tokio::test]
async fn a_page_boundary_that_falls_exactly_on_the_last_row_terminates() {
    let database = seeded_database().await;

    // Three movies with a limit of three: the first page is full, so the
    // lookahead row is what proves there is nothing more to fetch.
    let body = get_ok(&database, "/movies?limit=3").await;

    assert_eq!(body["items"].as_array().unwrap().len(), 3);
    assert!(
        body["next_cursor"].is_null(),
        "a full final page must not advertise another page"
    );
}

#[tokio::test]
async fn scene_pagination_is_scoped_to_its_movie() {
    let database = seeded_database().await;
    let movie_id = seed::seed_id("movie", "the-last-rehearsal");

    let (items, _) = drain_pages(&database, &format!("/movies/{movie_id}/scenes"), 1).await;

    assert_eq!(titles(&items), ["Auditions", "The Empty Theatre"]);
}

#[tokio::test]
async fn limits_outside_the_allowed_range_are_rejected() {
    let database = seeded_database().await;

    for path in ["/movies?limit=0", "/movies?limit=101", "/songs?limit=1000"] {
        let (status, body) = get(&database, path).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{path}");
        assert_eq!(body["code"], "validation_failed", "{path}");
    }

    let (status, _) = get(&database, "/movies?limit=100").await;
    assert_eq!(status, StatusCode::OK, "the maximum limit must be accepted");
}

#[tokio::test]
async fn malformed_and_foreign_cursors_are_rejected() {
    let database = seeded_database().await;
    let movie_id = seed::seed_id("movie", "midnight-in-lisbon");

    // A cursor for the scene collection replayed against movies: the key shape
    // does not match, so it must be refused rather than silently ignored.
    let scene_cursor = get_ok(&database, &format!("/movies/{movie_id}/scenes?limit=1")).await
        ["next_cursor"]
        .as_str()
        .expect("expected a scene cursor")
        .to_string();

    for path in [
        "/movies?cursor=not-base64!!".to_string(),
        "/movies?cursor=e30".to_string(),
        format!("/movies?cursor={scene_cursor}"),
    ] {
        let (status, body) = get(&database, &path).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{path}");
        assert_eq!(body["code"], "validation_failed", "{path}");
    }
}

#[tokio::test]
async fn scenes_of_an_unknown_movie_are_not_found() {
    let database = seeded_database().await;
    let unknown = Uuid::new_v4();

    let (status, body) = get(&database, &format!("/movies/{unknown}/scenes")).await;

    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "an unknown movie must be distinguishable from a movie with no scenes"
    );
    assert_eq!(body["code"], "resource_not_found");
}

#[tokio::test]
async fn a_malformed_movie_id_is_rejected() {
    let database = seeded_database().await;

    let (status, _) = get(&database, "/movies/not-a-uuid/scenes").await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn empty_collections_return_an_empty_page() {
    let database = migrated_database().await;

    let body = get_ok(&database, "/movies").await;

    assert_eq!(body["items"].as_array().unwrap().len(), 0);
    assert!(body["next_cursor"].is_null());
}
