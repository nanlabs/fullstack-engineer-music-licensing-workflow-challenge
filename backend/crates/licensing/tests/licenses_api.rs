//! License workflow API against a real PostgreSQL database. Same harness as
//! `tracks_api.rs`; covers the checklist in `docs/licensing.md`: the seeded
//! states in the track views and the `?state=` filter, the transition route
//! (defaults, notes, `source`, `expires_at`, `expected_state`, 422 and 409),
//! the history, the expiry sweep, scopes, tenant isolation and the cascade.
//! Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p licensing -- --include-ignored
//! ```

use std::sync::Arc;

use actix_web::http::StatusCode;
use actix_web::{test, web, App};
use chrono::Utc;
use iam::testing::{
    call, delete_as, get_as, login_with_otp, post_as, Outbox, ACME_ADMIN_EMAIL, ACME_LICENSING_EMAIL, ACME_TENANT,
};
use iam::IamConfig;
use serde_json::{json, Value};
use sqlx::PgPool;

/// Movies from `0004_seed_movies.sql`.
const ENCORE: &str = "44444444-4444-4444-8444-444444444441";
/// Scenes from `0006_seed_scenes.sql`.
const OPENING_NIGHT: &str = "55555555-5555-4555-8555-555555555551";
const FINAL_BOW: &str = "55555555-5555-4555-8555-555555555553";
/// Songs from `0008_seed_songs.sql`.
const PAPER_MOONS: &str = "66666666-6666-4666-8666-666666666664";
/// Tracks from `0010_seed_tracks.sql`, licensed by `0012_seed_licenses.sql`.
const T_OPENING: &str = "77777777-7777-4777-8777-777777777771";
const T_ROOFTOP: &str = "77777777-7777-4777-8777-777777777772";
const T_FINAL_BOW: &str = "77777777-7777-4777-8777-777777777773";
const T_SIGNAL: &str = "77777777-7777-4777-8777-777777777774";
/// The seeded licensing manager (`0002_seed_acme.sql`).
const LICENSING_MANAGER_ID: &str = "22222222-2222-4222-8222-222222222222";
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

fn transition(id: &str, event: &str) -> String {
    format!("/api/v1/tracks/{id}/license/{event}")
}

fn events(id: &str) -> String {
    format!("/api/v1/tracks/{id}/license/events")
}

fn item<'a>(body: &'a Value, id: &str) -> &'a Value {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["id"] == id)
        .unwrap_or_else(|| panic!("{id} not in {body}"))
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn license_workflow_history_sweep_and_isolation(pool: PgPool) {
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

    // Anonymous requests are rejected on both license routes.
    let r = call(
        &app,
        test::TestRequest::post()
            .uri(&transition(T_FINAL_BOW, "request"))
            .set_json(json!({}))
            .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);
    let r = call(&app, test::TestRequest::get().uri(&events(T_FINAL_BOW)).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    let admin = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT)
        .await
        .access_token;

    // The seeded states travel with the track views.
    let r = call(&app, get_as(&movie_tracks(ENCORE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 3);
    let opening = &item(&r.body, T_OPENING)["license"];
    assert_eq!(opening["state"], "approved");
    assert_eq!(opening["expires_at"], "2031-12-31T23:59:59Z");
    assert_eq!(opening["allowed_events"], json!(["expire"]));
    let rooftop = &item(&r.body, T_ROOFTOP)["license"];
    assert_eq!(rooftop["state"], "negotiating");
    assert_eq!(rooftop["updated_at"], "2026-10-20T11:00:00Z");
    assert!(rooftop["expires_at"].is_null());
    assert_eq!(rooftop["allowed_events"], json!(["approve", "reject"]));
    let final_bow = &item(&r.body, T_FINAL_BOW)["license"];
    assert_eq!(final_bow["state"], "pending");
    assert_eq!(final_bow["allowed_events"], json!(["request"]));
    let pending_updated_at = final_bow["updated_at"].as_str().unwrap().to_owned();

    // `?state=` filters both lists; an unknown state is a 400.
    let r = call(
        &app,
        get_as(&format!("{}?state=approved", movie_tracks(ENCORE)), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 1);
    assert_eq!(r.body["items"][0]["id"], T_OPENING);
    let r = call(
        &app,
        get_as(&format!("{}?state=pending", scene_tracks(OPENING_NIGHT)), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 0);
    let r = call(
        &app,
        get_as(&format!("{}?state=bogus", movie_tracks(ENCORE)), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);

    // An expired seed, with the sweep's event in its history.
    let r = call(&app, get_as(&track(T_SIGNAL), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "expired");
    assert_eq!(r.body["license"]["expires_at"], "2026-10-15T00:00:00Z");
    assert_eq!(r.body["license"]["allowed_events"], json!([]));
    let r = call(&app, get_as(&events(T_SIGNAL), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 4);
    let first = &r.body["items"][0];
    assert_eq!(
        (first["seq"].as_i64(), first["event"].as_str()),
        (Some(1), Some("request"))
    );
    assert_eq!(first["source"], "acme");
    assert_eq!(first["actor"]["user_id"], LICENSING_MANAGER_ID);
    assert_eq!(first["actor"]["name"], "Licensing Manager");
    let last = &r.body["items"][3];
    assert_eq!(
        (last["seq"].as_i64(), last["event"].as_str()),
        (Some(4), Some("expire"))
    );
    assert_eq!(
        (last["from_state"].as_str(), last["to_state"].as_str()),
        (Some("approved"), Some("expired"))
    );
    assert_eq!(last["source"], "system");
    assert!(last["actor"].is_null());
    assert_eq!(last["created_at"], "2026-10-15T00:05:00Z");

    // A new track is born pending with an empty history.
    let r = call(
        &app,
        post_as(
            &scene_tracks(FINAL_BOW),
            json!({ "song_id": PAPER_MOONS, "start_ms": 9000000, "end_ms": 9100000, "usage": "background" }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "pending");
    assert_eq!(r.body["license"]["allowed_events"], json!(["request"]));
    let created = r.body["id"].as_str().unwrap().to_owned();
    let r = call(&app, get_as(&events(&created), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 0);

    // A viewer reads the status with the tracks but cannot move a license
    // nor read its history.
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
    let r = call(&app, get_as(&movie_tracks(ENCORE), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(item(&r.body, T_OPENING)["license"]["state"], "approved");
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "request"), json!({}), &viewer).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["required_scope"], "licenses:write");
    let r = call(&app, get_as(&events(T_OPENING), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["required_scope"], "licenses:read");

    // The licensing manager (role, not wildcard) drives Final bow through
    // the workflow.
    let manager = login_with_otp(&app, &outbox, ACME_LICENSING_EMAIL, ACME_TENANT)
        .await
        .access_token;
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "request"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["id"], T_FINAL_BOW);
    assert_eq!(r.body["song"]["title"], "Velvet Static");
    assert_eq!(r.body["license"]["state"], "requested");
    assert_eq!(
        r.body["license"]["allowed_events"],
        json!(["start_negotiation", "reject"])
    );
    assert_ne!(r.body["license"]["updated_at"], pending_updated_at);
    let r = call(&app, get_as(&events(T_FINAL_BOW), &manager).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 1);
    let event = &r.body["items"][0];
    assert_eq!(event["seq"], 1);
    assert_eq!(event["event"], "request");
    assert_eq!(
        (event["from_state"].as_str(), event["to_state"].as_str()),
        (Some("pending"), Some("requested"))
    );
    assert_eq!(event["source"], "acme");
    assert_eq!(event["actor"]["user_id"], LICENSING_MANAGER_ID);
    assert_eq!(event["actor"]["name"], "Licensing Manager");
    assert!(event["note"].is_null());

    // An event the state does not allow is a 422 naming the alternatives.
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "approve"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY, "{}", r.body);
    assert_eq!(r.code(), "LICENSE_INVALID_TRANSITION");
    assert_eq!(r.body["error"]["details"]["state"], "requested");
    assert_eq!(r.body["error"]["details"]["event"], "approve");
    assert_eq!(
        r.body["error"]["details"]["allowed_events"],
        json!(["start_negotiation", "reject"])
    );

    // reject (ACME's own call, with a note) -> reopen -> approve with a term.
    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "reject"),
            json!({ "source": "acme", "note": "  Budget cut; parking the cue.  " }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "rejected");
    assert_eq!(r.body["license"]["allowed_events"], json!(["reopen"]));
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "reopen"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "negotiating");

    for (event, body) in [
        ("approve", json!({ "expires_at": "2020-01-01T00:00:00Z" })),
        ("request", json!({ "expires_at": "2031-06-30T00:00:00Z" })),
    ] {
        let r = call(
            &app,
            post_as(&transition(T_FINAL_BOW, event), body, &manager).to_request(),
        )
        .await;
        assert_eq!(r.status, StatusCode::BAD_REQUEST, "{event}: {}", r.body);
        assert_eq!(r.code(), "VALIDATION_ERROR");
        assert_eq!(r.body["error"]["details"]["field"], "expires_at");
    }
    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "approve"),
            json!({ "source": "system" }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "VALIDATION_ERROR");

    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "approve"),
            json!({ "expires_at": "2031-06-30T00:00:00Z", "note": "Three years, worldwide." }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "approved");
    assert_eq!(r.body["license"]["expires_at"], "2031-06-30T00:00:00Z");
    assert_eq!(r.body["license"]["allowed_events"], json!(["expire"]));
    let r = call(
        &app,
        post_as(&transition(T_FINAL_BOW, "approve"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY, "{}", r.body);

    // A stale expectation is a 409 that reports where the license is.
    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "expire"),
            json!({ "expected_state": "negotiating" }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "LICENSE_STATE_STALE");
    assert_eq!(r.body["error"]["details"]["state"], "approved");

    let r = call(&app, get_as(&events(T_FINAL_BOW), &manager).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 4);
    let kinds: Vec<&str> = r.body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["event"].as_str().unwrap())
        .collect();
    assert_eq!(kinds, ["request", "reject", "reopen", "approve"]);
    assert_eq!(r.body["items"][1]["source"], "acme");
    assert_eq!(r.body["items"][1]["note"], "Budget cut; parking the cue.");
    assert_eq!(r.body["items"][3]["source"], "rights_holder");
    assert_eq!(r.body["items"][3]["note"], "Three years, worldwide.");

    // While approved, the cue is frozen: the track cannot be removed.
    let r = call(&app, delete_as(&track(T_FINAL_BOW), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "TRACK_LOCKED_BY_LICENSE");
    assert_eq!(r.body["error"]["details"]["state"], "approved");

    // A manual expire keeps the date and closes the workflow.
    let r = call(
        &app,
        post_as(
            &transition(T_FINAL_BOW, "expire"),
            json!({ "expected_state": "approved" }),
            &manager,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "expired");
    assert_eq!(r.body["license"]["expires_at"], "2031-06-30T00:00:00Z");
    assert_eq!(r.body["license"]["allowed_events"], json!([]));

    // The sweep: Opening night's term is moved into the past.
    sqlx::query("UPDATE licenses SET expires_at = now() - interval '1 minute' WHERE track_id = $1::uuid")
        .bind(T_OPENING)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(licensing.license_service.expire_due(Utc::now()).await.unwrap(), 1);
    let r = call(&app, get_as(&track(T_OPENING), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["license"]["state"], "expired");
    let r = call(&app, get_as(&events(T_OPENING), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 4);
    let swept = &r.body["items"][3];
    assert_eq!(swept["event"], "expire");
    assert_eq!(swept["source"], "system");
    assert!(swept["actor"].is_null());
    assert_eq!(licensing.license_service.expire_due(Utc::now()).await.unwrap(), 0);

    // Another tenant's track is invisible to both routes.
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
    sqlx::query("INSERT INTO licenses (track_id, tenant_id) VALUES ($1::uuid, $2::uuid)")
        .bind(OTHER_TRACK)
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    let r = call(
        &app,
        post_as(&transition(OTHER_TRACK, "request"), json!({}), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "TRACK_NOT_FOUND");
    let r = call(&app, get_as(&events(OTHER_TRACK), &manager).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "TRACK_NOT_FOUND");
    // An event cannot be attached to a license of another tenant.
    let crossed = sqlx::query(
        "INSERT INTO license_events (id, tenant_id, track_id, seq, event, from_state, to_state, source) \
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 1, 'request', 'pending', 'requested', 'acme')",
    )
    .bind(ACME_TENANT)
    .bind(OTHER_TRACK)
    .execute(&pool)
    .await;
    assert!(
        matches!(crossed, Err(sqlx::Error::Database(ref db)) if db.is_foreign_key_violation()),
        "an event crossing tenants must violate the composite FK: {crossed:?}"
    );

    // Once expired, deleting the track takes its license and history with it.
    let r = call(&app, delete_as(&track(T_FINAL_BOW), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let (licenses, history): (i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM licenses WHERE track_id = $1::uuid), \
                (SELECT count(*) FROM license_events WHERE track_id = $1::uuid)",
    )
    .bind(T_FINAL_BOW)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!((licenses, history), (0, 0));
    let r = call(&app, get_as(&events(T_FINAL_BOW), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
}
