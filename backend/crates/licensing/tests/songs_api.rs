//! Songs API against a real PostgreSQL database. Same harness as
//! `movies_api.rs`; covers the checklist in `docs/licensing.md`: identifier
//! normalization, the partial unique index on ISRC (per tenant, NULLs free),
//! search on title or artist, partial updates that clear fields, the CHECK
//! mirrors and tenant isolation. Run with:
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

/// "Velvet Static" and "Paper Moons" from `0008_seed_songs.sql`.
const VELVET_STATIC: &str = "66666666-6666-4666-8666-666666666661";
const PAPER_MOONS: &str = "66666666-6666-4666-8666-666666666664";
const OTHER_TENANT: &str = "99999999-9999-4999-8999-999999999999";
const OTHER_SONG: &str = "99999999-9999-4999-8999-999999999903";
const VIEWER_ID: &str = "22222222-2222-4222-8222-222222222229";
const SONGS: &str = "/api/v1/songs";

fn song(id: &str) -> String {
    format!("{SONGS}/{id}")
}

fn titles(body: &Value) -> Vec<String> {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["title"].as_str().unwrap().to_owned())
        .collect()
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn songs_catalogue_identifiers_and_isolation(pool: PgPool) {
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

    // Anonymous requests are rejected by the middleware.
    let r = call(&app, test::TestRequest::get().uri(SONGS).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    let admin = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT)
        .await
        .access_token;

    // Seeded catalogue ordered by title; search matches title or artist.
    let r = call(&app, get_as(SONGS, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 4);
    assert_eq!(
        titles(&r.body),
        [
            "Frequency Drift",
            "Last Call at the Blue Room",
            "Paper Moons",
            "Velvet Static"
        ]
    );
    assert_eq!(r.body["items"][3]["id"], VELVET_STATIC);
    assert_eq!(r.body["items"][3]["isrc"], "QZACM2300017");
    assert_eq!(r.body["items"][3]["iswc"], "T9102345675");
    assert_eq!(r.body["items"][3]["rights_holder_kind"], "label");
    assert_eq!(r.body["items"][2]["rights_holder_kind"], Value::Null);
    assert_eq!(r.body["items"][2]["duration_ms"], Value::Null);
    let r = call(&app, get_as(&format!("{SONGS}?q=marrow"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 1);
    assert_eq!(r.body["items"][0]["title"], "Velvet Static");
    let r = call(&app, get_as(&format!("{SONGS}?q=STATIC"), &admin).to_request()).await;
    assert_eq!(r.body["pagination"]["total"], 1);
    // A literal percent sign is searched as text, not as a wildcard.
    let r = call(&app, get_as(&format!("{SONGS}?q=%25"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 0);
    let r = call(
        &app,
        get_as(&format!("{SONGS}?page_size=2&page=2"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(titles(&r.body), ["Paper Moons", "Velvet Static"]);

    // Create: identifiers accepted in print form and stored canonical, text trimmed.
    let create = json!({
        "title": "  Neon Tide  ",
        "artist": " Ines Calder ",
        "album": "Night Signals",
        "release_year": 2025,
        "duration_ms": 201000,
        "isrc": "gb-aaa-24-00001",
        "iswc": "T-034.524.680-1",
        "rights_holder": "Harbor Lane Records",
        "rights_holder_kind": "label",
        "rights_holder_email": "  licensing@harborlane.test ",
        "notes": "   "
    });
    let r = call(&app, post_as(SONGS, create, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["title"], "Neon Tide");
    assert_eq!(r.body["artist"], "Ines Calder");
    assert_eq!(r.body["isrc"], "GBAAA2400001");
    assert_eq!(r.body["iswc"], "T0345246801");
    assert_eq!(r.body["rights_holder_kind"], "label");
    assert_eq!(r.body["rights_holder_email"], "licensing@harborlane.test");
    assert_eq!(r.body["notes"], Value::Null);
    assert_eq!(r.body["tenant_id"], ACME_TENANT);
    let neon_id = r.str("/id");
    let neon = song(&neon_id);
    // Same title and artist again: versions are legitimate, only the ISRC is unique.
    let twin = json!({ "title": "Neon Tide", "artist": "Ines Calder", "rights_holder": "Ines Calder" });
    let r = call(&app, post_as(SONGS, twin, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    let twin_id = r.str("/id");

    // Validation: boundary (lengths, enum), service (identifiers, e-mail, ranges, blank).
    let base = json!({ "title": "X", "artist": "Y", "rights_holder": "Z" });
    for (patch, field) in [
        (json!({ "isrc": "GBAAA24000" }), Some("isrc")),
        (json!({ "isrc": "1BAAA2400001" }), Some("isrc")),
        (json!({ "iswc": "T-034.524.680-2" }), Some("iswc")),
        (json!({ "rights_holder_email": "nope" }), Some("rights_holder_email")),
        (json!({ "duration_ms": 0 }), Some("duration_ms")),
        (json!({ "release_year": 1800 }), Some("release_year")),
        (json!({ "rights_holder": "   " }), Some("rights_holder")),
        (json!({ "rights_holder_kind": "studio" }), None),
        (json!({ "title": "" }), None),
    ] {
        let mut body = base.clone();
        body.as_object_mut().unwrap().extend(patch.as_object().unwrap().clone());
        let r = call(&app, post_as(SONGS, body.clone(), &admin).to_request()).await;
        assert_eq!(r.status, StatusCode::BAD_REQUEST, "{body}: {}", r.body);
        assert_eq!(r.code(), "VALIDATION_ERROR", "{body}: {}", r.body);
        if let Some(field) = field {
            assert_eq!(r.body["error"]["details"]["field"], field, "{body}: {}", r.body);
        }
    }

    // One ISRC per tenant, on create and on update, whatever the print form.
    let dup = json!({ "title": "Velvet Static (Live)", "artist": "The Marrow Lights",
                      "rights_holder": "Harbor Lane Records", "isrc": "qz-acm-23-00017" });
    let r = call(&app, post_as(SONGS, dup, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "SONG_ISRC_TAKEN");
    assert_eq!(r.body["error"]["details"]["field"], "isrc");
    let r = call(
        &app,
        put_as(&song(&twin_id), json!({ "isrc": "GBAAA2400001" }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "SONG_ISRC_TAKEN");

    // Partial update: `""` clears text, `null` clears numbers and the kind, absent keeps.
    let patch = json!({
        "album": "",
        "isrc": "",
        "duration_ms": null,
        "rights_holder_kind": null,
        "notes": "Clean edit available"
    });
    let r = call(&app, put_as(&neon, patch, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["title"], "Neon Tide");
    assert_eq!(r.body["album"], Value::Null);
    assert_eq!(r.body["isrc"], Value::Null);
    assert_eq!(r.body["iswc"], "T0345246801");
    assert_eq!(r.body["duration_ms"], Value::Null);
    assert_eq!(r.body["release_year"], 2025);
    assert_eq!(r.body["rights_holder_kind"], Value::Null);
    assert_eq!(r.body["notes"], "Clean edit available");
    let r = call(
        &app,
        put_as(&neon, json!({ "iswc": "T-034.524.680-9" }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.body["error"]["details"]["field"], "iswc");
    let r = call(&app, get_as(&neon, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["isrc"], Value::Null);
    // The cleared ISRC is free again (partial index ignores NULLs).
    let reuse = json!({ "title": "Neon Tide (Radio Edit)", "artist": "Ines Calder",
                        "rights_holder": "Harbor Lane Records", "isrc": "GBAAA2400001" });
    let r = call(&app, post_as(SONGS, reuse, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);

    // The database mirrors the service rules for any other writer.
    let malformed = sqlx::query(
        "INSERT INTO songs (id, tenant_id, title, artist, rights_holder, isrc) \
         VALUES (gen_random_uuid(), $1::uuid, 'Bad', 'Bad', 'Bad', 'gb-aaa-24-00001')",
    )
    .bind(ACME_TENANT)
    .execute(&pool)
    .await;
    assert!(
        matches!(malformed, Err(sqlx::Error::Database(ref db)) if db.is_check_violation()),
        "a non-canonical ISRC must violate the CHECK: {malformed:?}"
    );

    // Tenant isolation: the same ISRC lives in another tenant, and its song is unreachable.
    sqlx::query("INSERT INTO tenants (id, slug, name) VALUES ($1::uuid, 'other', 'Other Studios')")
        .bind(OTHER_TENANT)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO songs (id, tenant_id, title, artist, rights_holder, isrc) \
         VALUES ($1::uuid, $2::uuid, 'Theirs', 'Them', 'Their Label', 'QZACM2300017')",
    )
    .bind(OTHER_SONG)
    .bind(OTHER_TENANT)
    .execute(&pool)
    .await
    .unwrap();
    let r = call(&app, get_as(&format!("{SONGS}?q=theirs"), &admin).to_request()).await;
    assert_eq!(r.body["pagination"]["total"], 0);
    let theirs = song(OTHER_SONG);
    for req in [
        get_as(&theirs, &admin),
        put_as(&theirs, json!({ "title": "Mine now" }), &admin),
        delete_as(&theirs, &admin),
    ] {
        let r = call(&app, req.to_request()).await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
        assert_eq!(r.code(), "SONG_NOT_FOUND");
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
    let r = call(&app, get_as(SONGS, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 7);
    let r = call(&app, get_as(&neon, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(&app, post_as(SONGS, base.clone(), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.code(), "ACCESS_DENIED");
    assert_eq!(r.body["error"]["details"]["required_scope"], "movies:write");
    let r = call(&app, put_as(&neon, json!({ "title": "Nope" }), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    let r = call(&app, delete_as(&neon, &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);

    // Delete: nothing references songs yet, so both a new and a seeded song go.
    let r = call(&app, delete_as(&neon, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&neon, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "SONG_NOT_FOUND");
    let r = call(&app, delete_as(&song(PAPER_MOONS), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(SONGS, &admin).to_request()).await;
    assert_eq!(r.body["pagination"]["total"], 5);
}
