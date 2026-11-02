//! Scenes API against a real PostgreSQL database. Same harness as
//! `movies_api.rs`; covers the checklist in `docs/licensing.md`: nested
//! routing next to the movie item routes, server-owned positions, the
//! tenant-consistent foreign key and cascade deletes. Run with:
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

/// "The Last Encore" and "Static" from `0004_seed_movies.sql`.
const ENCORE: &str = "44444444-4444-4444-8444-444444444441";
const STATIC: &str = "44444444-4444-4444-8444-444444444443";
/// "Opening night" from `0006_seed_scenes.sql`.
const OPENING_NIGHT: &str = "55555555-5555-4555-8555-555555555551";
/// Seeded tracks of Encore with an active license (approved, negotiating).
const T_OPENING: &str = "77777777-7777-4777-8777-777777777771";
const T_ROOFTOP: &str = "77777777-7777-4777-8777-777777777772";
const OTHER_TENANT: &str = "99999999-9999-4999-8999-999999999999";
const OTHER_MOVIE: &str = "99999999-9999-4999-8999-999999999901";
const OTHER_SCENE: &str = "99999999-9999-4999-8999-999999999902";
const VIEWER_ID: &str = "22222222-2222-4222-8222-222222222229";

fn scenes_of(movie: &str) -> String {
    format!("/api/v1/movies/{movie}/scenes")
}

fn field(body: &Value, name: &str) -> Vec<String> {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s[name].as_str().unwrap().to_owned())
        .collect()
}

fn positions(body: &Value) -> Vec<i64> {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["position"].as_i64().unwrap())
        .collect()
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn scenes_nested_routes_ordering_and_isolation(pool: PgPool) {
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

    // Anonymous requests are rejected on both route families.
    let r = call(&app, test::TestRequest::get().uri(&scenes_of(ENCORE)).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);
    let r = call(
        &app,
        test::TestRequest::get()
            .uri(&format!("/api/v1/scenes/{OPENING_NIGHT}"))
            .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    let admin = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT)
        .await
        .access_token;

    // Seeded scenes in position order; the movie item route still answers
    // next to the nested scope (prefix routing check).
    let r = call(&app, get_as(&scenes_of(ENCORE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 3);
    assert_eq!(
        field(&r.body, "title"),
        ["Opening night", "Rooftop confession", "Final bow"]
    );
    assert_eq!(positions(&r.body), [1, 2, 3]);
    assert_eq!(r.body["items"][0]["start_ms"], 0);
    assert_eq!(r.body["items"][0]["end_ms"], 180000);
    assert_eq!(r.body["items"][2]["start_ms"], Value::Null);
    let r = call(&app, get_as(&scenes_of(STATIC), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 0);
    assert_eq!(r.body["items"], json!([]));
    let r = call(&app, get_as(&format!("/api/v1/movies/{ENCORE}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "The Last Encore");

    // Unknown movie.
    let r = call(
        &app,
        get_as(&scenes_of("44444444-4444-4444-8444-444444444499"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");

    // Validation at the boundary (length, range) and in the service (window rules).
    for body in [
        json!({ "title": "" }),
        json!({ "title": "X", "start_ms": 10, "end_ms": 5 }),
        json!({ "title": "X", "start_ms": 10 }),
        json!({ "title": "X", "start_ms": -1, "end_ms": 5 }),
        json!({ "title": "   " }),
    ] {
        let r = call(&app, post_as(&scenes_of(ENCORE), body.clone(), &admin).to_request()).await;
        assert_eq!(r.status, StatusCode::BAD_REQUEST, "{body}: {}", r.body);
        assert_eq!(r.code(), "VALIDATION_ERROR");
    }

    // Create appends at the end.
    let create = json!({
        "title": "  Encore  ",
        "description": "The crowd will not leave.",
        "start_ms": 5400000,
        "end_ms": 5700000
    });
    let r = call(&app, post_as(&scenes_of(ENCORE), create, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["title"], "Encore");
    assert_eq!(r.body["position"], 4);
    assert_eq!(r.body["movie_id"], ENCORE);
    assert_eq!(r.body["tenant_id"], ACME_TENANT);
    let encore_id = r.str("/id");
    let item = format!("/api/v1/scenes/{encore_id}");

    // Item routes: read and partial update (`null` clears the window, `""` clears the text).
    let r = call(&app, get_as(&item, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["description"], "The crowd will not leave.");
    let patch = json!({ "title": "Second encore", "description": "", "start_ms": null, "end_ms": null });
    let r = call(&app, put_as(&item, patch, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "Second encore");
    assert_eq!(r.body["description"], Value::Null);
    assert_eq!(r.body["start_ms"], Value::Null);
    assert_eq!(r.body["end_ms"], Value::Null);
    assert_eq!(r.body["position"], 4);
    let r = call(
        &app,
        put_as(&item, json!({ "start_ms": 10, "end_ms": 5 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "VALIDATION_ERROR");
    // A window can be set again later, in one go.
    let r = call(
        &app,
        put_as(&item, json!({ "start_ms": 5400000, "end_ms": 5700000 }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["end_ms"], 5700000);

    // Reorder: the full set in a new order; anything else is a validation
    // error naming the ids.
    let order = format!("{}/order", scenes_of(ENCORE));
    let r = call(&app, get_as(&scenes_of(ENCORE), &admin).to_request()).await;
    let current = field(&r.body, "id");
    assert_eq!(current.len(), 4);
    let reversed: Vec<String> = current.iter().rev().cloned().collect();
    let r = call(
        &app,
        put_as(&order, json!({ "scene_ids": reversed }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(field(&r.body, "id"), reversed);
    assert_eq!(positions(&r.body), [1, 2, 3, 4]);
    let r = call(&app, get_as(&scenes_of(ENCORE), &admin).to_request()).await;
    assert_eq!(field(&r.body, "id"), reversed);
    assert_eq!(field(&r.body, "title")[0], "Second encore");

    let bad = json!({ "scene_ids": [reversed[0], reversed[1], reversed[1]] });
    let r = call(&app, put_as(&order, bad, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "VALIDATION_ERROR");
    assert_eq!(r.body["error"]["details"]["duplicates"], json!([reversed[1]]));
    assert_eq!(r.body["error"]["details"]["missing"], json!([reversed[2], reversed[3]]));
    assert_eq!(r.body["error"]["details"]["unknown"], json!([]));
    // A scene of another movie is "unknown" for this one.
    let r = call(
        &app,
        put_as(
            &format!("{}/order", scenes_of(STATIC)),
            json!({ "scene_ids": [OPENING_NIGHT] }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["unknown"], json!([OPENING_NIGHT]));
    let r = call(&app, put_as(&order, json!({ "scene_ids": [] }), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);

    // Tenant isolation: another tenant's movie and scene are invisible, and
    // the composite foreign key rejects a scene whose tenant differs from its
    // movie's even when inserted directly.
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
    let crossed = sqlx::query(
        "INSERT INTO scenes (id, tenant_id, movie_id, position, title) \
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 2, 'Crossed')",
    )
    .bind(ACME_TENANT)
    .bind(OTHER_MOVIE)
    .execute(&pool)
    .await;
    assert!(
        matches!(crossed, Err(sqlx::Error::Database(ref db)) if db.is_foreign_key_violation()),
        "a scene with a foreign movie must violate the composite FK: {crossed:?}"
    );

    let r = call(&app, get_as(&scenes_of(OTHER_MOVIE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
    let r = call(
        &app,
        post_as(&scenes_of(OTHER_MOVIE), json!({ "title": "Sneaky" }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
    let theirs = format!("/api/v1/scenes/{OTHER_SCENE}");
    for req in [
        get_as(&theirs, &admin),
        put_as(&theirs, json!({ "title": "Mine now" }), &admin),
        delete_as(&theirs, &admin),
    ] {
        let r = call(&app, req.to_request()).await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
        assert_eq!(r.code(), "SCENE_NOT_FOUND");
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
    let r = call(&app, get_as(&scenes_of(ENCORE), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 4);
    let r = call(
        &app,
        post_as(&scenes_of(ENCORE), json!({ "title": "Nope" }), &viewer).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.code(), "ACCESS_DENIED");
    assert_eq!(r.body["error"]["details"]["required_scope"], "movies:write");
    let r = call(
        &app,
        put_as(&order, json!({ "scene_ids": reversed }), &viewer).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    let r = call(&app, delete_as(&item, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);

    // Delete a scene, then the movie: scenes go with it.
    let r = call(&app, delete_as(&item, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&item, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "SCENE_NOT_FOUND");
    let r = call(&app, get_as(&scenes_of(ENCORE), &admin).to_request()).await;
    assert_eq!(r.body["count"], 3);

    // The movie goes only once no track of its scenes has an active
    // license: Opening is approved and Rooftop is in negotiation.
    let encore = format!("/api/v1/movies/{ENCORE}");
    let r = call(&app, delete_as(&encore, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_HAS_ACTIVE_LICENSES");
    let mut locked: Vec<String> = serde_json::from_value(r.body["error"]["details"]["track_ids"].clone()).unwrap();
    locked.sort();
    assert_eq!(locked, [T_OPENING, T_ROOFTOP]);
    for (id, event) in [(T_OPENING, "expire"), (T_ROOFTOP, "reject")] {
        let r = call(
            &app,
            post_as(&format!("/api/v1/tracks/{id}/license/{event}"), json!({}), &admin).to_request(),
        )
        .await;
        assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    }
    let r = call(&app, delete_as(&encore, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&scenes_of(ENCORE), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM scenes WHERE movie_id = $1::uuid")
        .bind(ENCORE)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 0);
}
