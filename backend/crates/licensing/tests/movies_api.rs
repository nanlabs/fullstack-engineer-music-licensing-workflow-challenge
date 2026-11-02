//! Movies API against a real PostgreSQL database. `#[sqlx::test]` creates a
//! throwaway database per test from `DATABASE_URL` and applies `migrations/`
//! (IAM and movie seeds included). Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p licensing -- --include-ignored
//! ```

use std::sync::Arc;

use actix_web::http::StatusCode;
use actix_web::{test, web, App};
use iam::testing::{
    call, delete_as, get_as, login_with_otp, post_as, put_as, Outbox, ACME_ADMIN_EMAIL, ACME_LICENSING_EMAIL,
    ACME_TENANT,
};
use iam::IamConfig;
use serde_json::{json, Value};
use sqlx::PgPool;

/// "Midnight Frequencies" from `0004_seed_movies.sql`.
const SEED_RELEASED: &str = "44444444-4444-4444-8444-444444444442";
const OTHER_TENANT: &str = "99999999-9999-4999-8999-999999999999";
const OTHER_MOVIE: &str = "99999999-9999-4999-8999-999999999901";
const VIEWER_ID: &str = "22222222-2222-4222-8222-222222222229";

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p licensing -- --include-ignored`"]
async fn movies_crud_authorization_and_tenant_isolation(pool: PgPool) {
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
    let r = call(&app, test::TestRequest::get().uri("/api/v1/movies").to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    let admin = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT)
        .await
        .access_token;

    // Seeded catalogue, ordering, search and status filter.
    let r = call(&app, get_as("/api/v1/movies", &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 3);
    assert_eq!(r.body["items"][0]["title"], "Midnight Frequencies");
    let r = call(&app, get_as("/api/v1/movies?q=encore", &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 1);
    assert_eq!(r.body["items"][0]["title"], "The Last Encore");
    let r = call(
        &app,
        get_as("/api/v1/movies?status=released&page_size=1", &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 1);
    assert_eq!(r.body["items"][0]["id"], SEED_RELEASED);
    // A literal percent sign is searched as text, not as a wildcard.
    let r = call(&app, get_as("/api/v1/movies?q=%25", &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 0);

    // Validation happens before the service is reached.
    let r = call(
        &app,
        post_as("/api/v1/movies", json!({ "title": "" }), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "VALIDATION_ERROR");
    let r = call(
        &app,
        post_as(
            "/api/v1/movies",
            json!({ "title": "Old", "release_year": 1500 }),
            &admin,
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "VALIDATION_ERROR");

    // Create, read, update.
    let create = json!({
        "title": "  Neon Tide ",
        "synopsis": "Surfers vs. synths",
        "release_year": 2027,
        "status": "in_production"
    });
    let r = call(&app, post_as("/api/v1/movies", create, &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["title"], "Neon Tide");
    assert_eq!(r.body["status"], "in_production");
    assert_eq!(r.body["tenant_id"], ACME_TENANT);
    let id = r.str("/id");

    let r = call(&app, get_as(&format!("/api/v1/movies/{id}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["synopsis"], "Surfers vs. synths");

    let update = json!({ "status": "released", "synopsis": "" });
    let r = call(
        &app,
        put_as(&format!("/api/v1/movies/{id}"), update, &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["status"], "released");
    assert_eq!(r.body["synopsis"], Value::Null);
    assert_eq!(r.body["release_year"], 2027);

    let r = call(&app, get_as("/api/v1/movies", &admin).to_request()).await;
    assert_eq!(r.body["pagination"]["total"], 4);

    // Tenant isolation: another tenant's movie is invisible and unreachable.
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
    let r = call(&app, get_as("/api/v1/movies?q=yours", &admin).to_request()).await;
    assert_eq!(r.body["pagination"]["total"], 0);
    let r = call(
        &app,
        get_as(&format!("/api/v1/movies/{OTHER_MOVIE}"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
    let r = call(
        &app,
        delete_as(&format!("/api/v1/movies/{OTHER_MOVIE}"), &admin).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);

    // Authorization at the service boundary: role scopes (`movies:*`) allow
    // writes; a member with only `movies:read` gets 403 naming the scope.
    let manager = login_with_otp(&app, &outbox, ACME_LICENSING_EMAIL, ACME_TENANT)
        .await
        .access_token;
    let r = call(
        &app,
        post_as("/api/v1/movies", json!({ "title": "Manager's Cut" }), &manager).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);

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
    let r = call(&app, get_as("/api/v1/movies", &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 5);
    let r = call(
        &app,
        post_as("/api/v1/movies", json!({ "title": "Nope" }), &viewer).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.code(), "ACCESS_DENIED");
    assert_eq!(r.body["error"]["details"]["required_scope"], "movies:write");
    let r = call(&app, delete_as(&format!("/api/v1/movies/{id}"), &viewer).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);

    // Delete, then it is gone.
    let r = call(&app, delete_as(&format!("/api/v1/movies/{id}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT, "{}", r.body);
    let r = call(&app, get_as(&format!("/api/v1/movies/{id}"), &admin).to_request()).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND, "{}", r.body);
    assert_eq!(r.code(), "MOVIE_NOT_FOUND");
}
