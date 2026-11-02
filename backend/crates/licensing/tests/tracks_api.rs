//! Tracks API against a real PostgreSQL database. Same harness as
//! `scenes_api.rs`; covers the checklist in `docs/licensing.md`: the three
//! route families next to each other, the joined view (movie and song
//! summary), the scene-window invariant from both sides, the song foreign
//! key (`SONG_IN_USE`, unknown or foreign `song_id`), tenant isolation and
//! cascade deletes. Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p licensing -- --include-ignored
//! ```

use std::sync::Arc;

use actix_web::http::StatusCode;
use actix_web::{test, web, App};
use iam::testing::{call, delete_as, get_as, login_with_otp, post_as, put_as, Outbox, ACME_ADMIN_EMAIL, ACME_TENANT};
use iam::IamConfig;
use serde_json::{json, Value};
use sqlx::PgPool;

/// Movies from `0004_seed_movies.sql`.
const ENCORE: &str = "44444444-4444-4444-8444-444444444441";
const MIDNIGHT: &str = "44444444-4444-4444-8444-444444444442";
const STATIC: &str = "44444444-4444-4444-8444-444444444443";
/// Scenes from `0006_seed_scenes.sql`.
const OPENING_NIGHT: &str = "55555555-5555-4555-8555-555555555551";
const ROOFTOP: &str = "55555555-5555-4555-8555-555555555552";
const FINAL_BOW: &str = "55555555-5555-4555-8555-555555555553";
/// Songs from `0008_seed_songs.sql`.
const VELVET_STATIC: &str = "66666666-6666-4666-8666-666666666661";
const LAST_CALL: &str = "66666666-6666-4666-8666-666666666662";
const FREQUENCY_DRIFT: &str = "66666666-6666-4666-8666-666666666663";
const PAPER_MOONS: &str = "66666666-6666-4666-8666-666666666664";
/// Tracks from `0010_seed_tracks.sql`.
const T_OPENING: &str = "77777777-7777-4777-8777-777777777771";
const T_ROOFTOP: &str = "77777777-7777-4777-8777-777777777772";
const T_FINAL_BOW: &str = "77777777-7777-4777-8777-777777777773";
const T_SIGNAL: &str = "77777777-7777-4777-8777-777777777774";
const OTHER_TENANT: &str = "99999999-9999-4999-8999-999999999999";
const OTHER_MOVIE: &str = "99999999-9999-4999-8999-999999999901";
const OTHER_SCENE: &str = "99999999-9999-4999-8999-999999999902";
const OTHER_SONG: &str = "99999999-9999-4999-8999-999999999903";
const OTHER_TRACK: &str = "99999999-9999-4999-8999-999999999904";
const VIEWER_ID: &str = "22222222-2222-4222-8222-222222222229";

fn scene_tracks(scene: &str) -> String {
    format!("/api/v1/scenes/{scene}/tracks")
}

fn movie_tracks(movie: &str) -> String {
    format!("/api/v1/movies/{movie}/tracks")
}

fn track(id: &str) -> String {
    format!("/api/v1/tracks/{id}")
}

fn field(body: &Value, name: &str) -> Vec<String> {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t[name].as_str().unwrap().to_owned())
        .collect()
}

fn cue(song_id: &str, start_ms: i64, end_ms: i64, usage: &str) -> Value {
    json!({ "song_id": song_id, "start_ms": start_ms, "end_ms": end_ms, "usage": usage })
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn tracks_views_window_invariant_and_isolation(pool: PgPool) {
    let outbox = Arc::new(Outbox::default());
    let iam = iam::Container::new(iam::Deps {
        pool: pool.clone(),
        config: IamConfig::development("test-secret-that-is-long-enough-for-hs256!!"),
        otp_notifier: outbox.clone(),
        invitation_notifier: outbox.clone(),
    });
    let licensing = licensing::Container::new(licensing::Deps {
        pool: pool.clone(),
        config: licensing::LicensingConfig::default(),
        redis: None,
        shutdown: tokio_util::sync::CancellationToken::new(),
    });
    let app = test::init_service(
        App::new().service(
            web::scope("/api/v1")
                .configure(|cfg| iam.configure(cfg))
                .configure(|cfg| licensing.configure(cfg)),
        ),
    )
    .await;

    // Anonymous requests are rejected on the three route families.
    for uri in [scene_tracks(OPENING_NIGHT), movie_tracks(ENCORE), track(T_OPENING)] {
        let r = call(&app, test::TestRequest::get().uri(&uri).to_request()).await;
        assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{uri}: {}", r.body);
    }

    let admin = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT)
        .await
        .access_token;

    // The scene view: the seeded cue with the song summary joined in.
    let r = call(&app, get_as(&scene_tracks(OPENING_NIGHT), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 1);
    let item = &r.body["items"][0];
    assert_eq!(item["id"], T_OPENING);
    assert_eq!(item["movie_id"], ENCORE);
    assert_eq!(item["scene_id"], OPENING_NIGHT);
    assert_eq!(item["tenant_id"], ACME_TENANT);
    assert_eq!(item["song"]["id"], VELVET_STATIC);
    assert_eq!(item["song"]["title"], "Velvet Static");
    assert_eq!(item["song"]["artist"], "The Marrow Lights");
    assert_eq!(item["song"]["rights_holder"], "Harbor Lane Records");
    assert_eq!(item["start_ms"], 15000);
    assert_eq!(item["end_ms"], 95000);
    assert_eq!(item["duration_ms"], 80000);
    assert_eq!(item["usage"], "background");

    // The movie view: scene position first, then start; sibling routes under
    // `/movies/{id}` keep answering (prefix routing check).
    let r = call(&app, get_as(&movie_tracks(ENCORE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 3);
    assert_eq!(field(&r.body, "id"), [T_OPENING, T_ROOFTOP, T_FINAL_BOW]);
    assert_eq!(field(&r.body, "scene_id"), [OPENING_NIGHT, ROOFTOP, FINAL_BOW]);
    assert_eq!(r.body["items"][2]["duration_ms"], 180000);
    let r = call(&app, get_as(&movie_tracks(STATIC), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 0);
    let r = call(&app, get_as(&format!("/api/v1/movies/{ENCORE}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "The Last Encore");
    let r = call(
        &app,
        get_as(&format!("/api/v1/movies/{ENCORE}/scenes"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 3);
    let r = call(&app, get_as(&format!("/api/v1/scenes/{ROOFTOP}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "Rooftop confession");

    // Unknown parents.
    let r = call(
        &app,
        get_as(&movie_tracks("44444444-4444-4444-8444-444444444499"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
    let r = call(
        &app,
        get_as(&scene_tracks("55555555-5555-4555-8555-555555555599"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "SCENE_NOT_FOUND");
    // (Malformed ids become 400 through the `PathConfig` installed by the
    // `app` crate, which this harness does not register.)

    // Create inside Rooftop confession (window 420000..600000), overlapping
    // the seeded cue: overlaps are allowed.
    let r = call(
        &app,
        post_as(
            &scene_tracks(ROOFTOP),
            cue(LAST_CALL, 500000, 560000, "background"),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["movie_id"], ENCORE);
    assert_eq!(r.body["scene_id"], ROOFTOP);
    assert_eq!(r.body["song"]["title"], "Last Call at the Blue Room");
    assert_eq!(r.body["duration_ms"], 60000);
    assert_eq!(r.body["usage"], "background");
    let new_id = r.str("/id");
    let new_item = track(&new_id);

    // Validation: span and window rules name the field; the window error
    // also carries the scene bounds.
    for (body, expected_field) in [
        (cue(LAST_CALL, 100000, 150000, "background"), Some("start_ms")),
        (cue(LAST_CALL, 500000, 700000, "background"), Some("end_ms")),
        (cue(LAST_CALL, 500000, 500000, "background"), Some("end_ms")),
        (cue(LAST_CALL, 550000, 500000, "background"), Some("end_ms")),
        (cue(LAST_CALL, -1, 500000, "background"), None),
        (cue(LAST_CALL, 500000, 560000, "theme"), None),
        (
            cue("66666666-6666-4666-8666-666666666699", 500000, 560000, "featured"),
            Some("song_id"),
        ),
        (
            json!({ "start_ms": 500000, "end_ms": 560000, "usage": "featured" }),
            None,
        ),
    ] {
        let r = call(&app, post_as(&scene_tracks(ROOFTOP), body.clone(), &admin).to_request()).await;
        assert_eq!(r.status, StatusCode::BAD_REQUEST, "{body}: {}", r.body);
        assert_eq!(r.code(), "VALIDATION_ERROR", "{body}");
        if let Some(name) = expected_field {
            assert_eq!(r.body["error"]["details"]["field"], name, "{body}: {}", r.body);
        }
    }
    let r = call(
        &app,
        post_as(
            &scene_tracks(ROOFTOP),
            cue(LAST_CALL, 100000, 150000, "background"),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.body["error"]["details"]["scene_start_ms"], 420000);
    assert_eq!(r.body["error"]["details"]["scene_end_ms"], 600000);

    // A scene without a window accepts any span.
    let r = call(
        &app,
        post_as(
            &scene_tracks(FINAL_BOW),
            cue(PAPER_MOONS, 9000000, 9100000, "featured"),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["song"]["title"], "Paper Moons");

    // Partial update: timing, song and usage; the window still applies.
    let r = call(
        &app,
        put_as(&new_item, json!({ "end_ms": 580000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["duration_ms"], 80000);
    let r = call(
        &app,
        put_as(
            &new_item,
            json!({ "song_id": FREQUENCY_DRIFT, "usage": "featured" }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["song"]["id"], FREQUENCY_DRIFT);
    assert_eq!(r.body["song"]["title"], "Frequency Drift");
    assert_eq!(r.body["song"]["rights_holder"], "Northline Publishing");
    assert_eq!(r.body["usage"], "featured");
    assert_eq!(r.body["start_ms"], 500000);
    let r = call(
        &app,
        put_as(&new_item, json!({ "start_ms": 400000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["field"], "start_ms");
    let r = call(
        &app,
        put_as(
            &new_item,
            json!({ "song_id": "66666666-6666-4666-8666-666666666699" }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["field"], "song_id");
    let r = call(&app, get_as(&new_item, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["song"]["id"], FREQUENCY_DRIFT);
    assert_eq!(r.body["end_ms"], 580000);

    // The other direction of the invariant: a scene cannot narrow its window
    // past its tracks. The seeded cue starts at 430000.
    let rooftop = format!("/api/v1/scenes/{ROOFTOP}");
    let r = call(
        &app,
        put_as(&rooftop, json!({ "start_ms": 450000, "end_ms": 600000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "SCENE_WINDOW_CONFLICT");
    assert_eq!(r.body["error"]["details"]["track_ids"], json!([T_ROOFTOP]));
    let r = call(
        &app,
        put_as(&rooftop, json!({ "start_ms": 420000, "end_ms": 590000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(
        &app,
        put_as(&rooftop, json!({ "start_ms": null, "end_ms": null }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(
        &app,
        put_as(&rooftop, json!({ "start_ms": 420000, "end_ms": 600000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);

    // A placed song cannot be deleted until its tracks are gone.
    let velvet = format!("/api/v1/songs/{VELVET_STATIC}");
    let r = call(&app, delete_as(&velvet, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "SONG_IN_USE");

    // And a track can neither change nor go while its license is active:
    // Opening is approved, so its cue is frozen until the license expires.
    let opening = track(T_OPENING);
    let r = call(&app, get_as(&opening, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let stored_usage = r.body["usage"].clone();
    let r = call(
        &app,
        put_as(
            &opening,
            json!({ "usage": "featured", "end_ms": r.body["end_ms"] }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "TRACK_LOCKED_BY_LICENSE");
    assert_eq!(r.body["error"]["details"]["state"], "approved");
    assert_eq!(r.body["error"]["details"]["fields"], json!(["usage"]));
    // Repeating the stored values is not a change.
    let r = call(
        &app,
        put_as(&opening, json!({ "usage": stored_usage }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(&app, delete_as(&opening, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "TRACK_LOCKED_BY_LICENSE");
    assert!(r.body["error"]["details"].get("fields").is_none(), "{}", r.body);
    let r = call(
        &app,
        post_as(&format!("{opening}/license/expire"), json!({}), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "expired");
    for id in [T_OPENING, T_FINAL_BOW] {
        let r = call(&app, delete_as(&track(id), &admin).to_request()).await;
        assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    }
    let r = call(&app, delete_as(&velvet, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&track(T_OPENING), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "TRACK_NOT_FOUND");
    let r = call(&app, get_as(&movie_tracks(ENCORE), &admin).to_request()).await;
    assert_eq!(r.body["count"], 3);
    assert_eq!(field(&r.body, "scene_id"), [ROOFTOP, ROOFTOP, FINAL_BOW]);

    // Tenant isolation: another tenant's scene, song and track are invisible
    // or unusable, and the composite foreign keys reject a track whose tenant
    // differs from its scene's or its song's even when inserted directly.
    sqlx::query("INSERT INTO tenants (id, slug, name) VALUES ($1::uuid, 'other', 'Other Studios')")
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO movies (id, tenant_id, title) VALUES ($1::uuid, $2::uuid, 'Not Yours')")
        .bind(OTHER_MOVIE)
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO scenes (id, tenant_id, movie_id, position, title) \
         VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'Their scene')",
    )
    .bind(OTHER_SCENE)
    .bind(OTHER_TENANT)
    .bind(OTHER_MOVIE)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO songs (id, tenant_id, title, artist, rights_holder) \
         VALUES ($1::uuid, $2::uuid, 'Their Song', 'Them', 'Their Label')",
    )
    .bind(OTHER_SONG)
    .bind(OTHER_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO tracks (id, tenant_id, scene_id, song_id, start_ms, end_ms, usage) \
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 0, 1000, 'background')",
    )
    .bind(OTHER_TRACK)
    .bind(OTHER_TENANT)
    .bind(OTHER_SCENE)
    .bind(OTHER_SONG)
    .execute(&pool)
    .await
    .unwrap();
    for (scene, song) in [(OTHER_SCENE, LAST_CALL), (ROOFTOP, OTHER_SONG)] {
        let crossed = sqlx::query(
            "INSERT INTO tracks (id, tenant_id, scene_id, song_id, start_ms, end_ms, usage) \
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 0, 1000, 'background')",
        )
        .bind(ACME_TENANT)
        .bind(scene)
        .bind(song)
        .execute(&pool)
        .await;
        assert!(
            matches!(crossed, Err(sqlx::Error::Database(ref db)) if db.is_foreign_key_violation()),
            "a track crossing tenants must violate a composite FK: {crossed:?}"
        );
    }
    let r = call(&app, get_as(&scene_tracks(OTHER_SCENE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "SCENE_NOT_FOUND");
    let r = call(
        &app,
        post_as(&scene_tracks(OTHER_SCENE), cue(LAST_CALL, 0, 1000, "featured"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "SCENE_NOT_FOUND");
    let r = call(&app, get_as(&movie_tracks(OTHER_MOVIE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
    let r = call(
        &app,
        post_as(
            &scene_tracks(ROOFTOP),
            cue(OTHER_SONG, 500000, 510000, "featured"),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["field"], "song_id");
    let theirs = track(OTHER_TRACK);
    for req in [
        get_as(&theirs, &admin),
        put_as(&theirs, json!({ "usage": "featured" }), &admin),
        delete_as(&theirs, &admin),
    ] {
        let r = call(&app, req.to_request()).await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
        assert_eq!(r.code(), "TRACK_NOT_FOUND");
    }

    // Authorization at the service boundary: `movies:read` lists, nothing more.
    sqlx::query(
        "INSERT INTO users (id, tenant_id, email, name, status, scopes, email_verified) \
         VALUES ($1::uuid, $2::uuid, 'viewer@acme.test', 'Viewer', 'active', '{movies:read}', true)",
    )
    .bind(VIEWER_ID)
    .bind(ACME_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    let viewer = login_with_otp(&app, &outbox, "viewer@acme.test", ACME_TENANT)
        .await
        .access_token;
    let r = call(&app, get_as(&scene_tracks(ROOFTOP), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 2);
    let r = call(&app, get_as(&movie_tracks(ENCORE), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(&app, get_as(&new_item, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(
        &app,
        post_as(
            &scene_tracks(ROOFTOP),
            cue(LAST_CALL, 500000, 510000, "featured"),
            &viewer,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.code(), "ACCESS_DENIED");
    assert_eq!(r.body["error"]["details"]["required_scope"], "movies:write");
    let r = call(
        &app,
        put_as(&new_item, json!({ "usage": "background" }), &viewer).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    let r = call(&app, delete_as(&new_item, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);

    // Ownership cascades: deleting a scene removes its tracks, deleting a
    // movie removes the tracks of its scenes; songs are untouched. Not while
    // a track inside has an active license, though: Rooftop's cue is in
    // negotiation, so the scene stays until that license is rejected.
    let r = call(&app, delete_as(&rooftop, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "SCENE_HAS_ACTIVE_LICENSES");
    assert_eq!(r.body["error"]["details"]["track_ids"], json!([T_ROOFTOP]));
    let r = call(
        &app,
        post_as(&format!("{}/license/reject", track(T_ROOFTOP)), json!({}), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(&app, delete_as(&rooftop, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&new_item, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM tracks WHERE scene_id = $1::uuid")
        .bind(ROOFTOP)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 0);
    let r = call(
        &app,
        delete_as(&format!("/api/v1/movies/{MIDNIGHT}"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM tracks WHERE id = $1::uuid")
        .bind(T_SIGNAL)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 0);
    let r = call(
        &app,
        get_as(&format!("/api/v1/songs/{FREQUENCY_DRIFT}"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "Frequency Drift");
}
