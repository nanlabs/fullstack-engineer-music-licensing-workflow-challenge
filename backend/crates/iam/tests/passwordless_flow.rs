//! End-to-end passwordless flow against a real PostgreSQL database.
//!
//! `#[sqlx::test]` creates a throwaway database per test from `DATABASE_URL`
//! and applies `migrations/` (including the ACME seed). Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p iam -- --include-ignored
//! ```

use std::sync::Arc;

use actix_web::http::StatusCode;
use actix_web::{test, web, App};
use iam::otp::OtpPurpose;
use iam::testing::{
    call, get_as, login_with_otp, post, post_as, Outbox, ACME_TENANT as TENANT, LOGIN_INITIATE, LOGIN_VERIFY,
    ROLE_LICENSING_MANAGER, SIGNUP_INITIATE, SIGNUP_INVITATION, SIGNUP_VERIFY,
};
use iam::{Container, Deps, IamConfig};
use serde_json::{json, Value};
use sqlx::PgPool;

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p iam -- --include-ignored`"]
async fn passwordless_flow_end_to_end(pool: PgPool) {
    let outbox = Arc::new(Outbox::default());
    let container = Container::new(Deps {
        pool,
        config: IamConfig::development("test-secret-that-is-long-enough-for-hs256!!"),
        otp_notifier: outbox.clone(),
        invitation_notifier: outbox.clone(),
    });
    let app =
        test::init_service(App::new().service(web::scope("/api/v1").configure(|cfg| container.configure(cfg)))).await;

    // Discovery: which tenants know this email.
    let r = call(
        &app,
        post(
            "/api/v1/auth/passwordless/tenants",
            json!({ "email": "Admin@acme.test" }),
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 1);
    assert_eq!(r.body["tenants"][0]["tenant_slug"], "acme");

    // Admin login: initiate, immediate retry is rate limited, wrong code, right code.
    let admin_initiate = json!({ "email": "admin@acme.test", "tenant_id": TENANT });
    let r = call(&app, post(LOGIN_INITIATE, admin_initiate.clone()).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let r = call(&app, post(LOGIN_INITIATE, admin_initiate).to_request()).await;
    assert_eq!(r.status, StatusCode::TOO_MANY_REQUESTS, "{}", r.body);
    assert_eq!(r.code(), "OTP_TOO_MANY_REQUESTS");
    assert!(r.body["error"]["details"]["retry_after"].as_i64().unwrap_or(0) > 0);

    let code = outbox.last_otp("admin@acme.test", OtpPurpose::Login);
    let wrong = json!({ "email": "admin@acme.test", "tenant_id": TENANT, "code": "000000" });
    let r = call(&app, post(LOGIN_VERIFY, wrong).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "OTP_INVALID");
    assert_eq!(r.body["error"]["details"]["attempts_remaining"], 4);

    let right = json!({ "email": "admin@acme.test", "tenant_id": TENANT, "code": code });
    let r = call(&app, post(LOGIN_VERIFY, right).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["token_type"], "Bearer");
    assert_eq!(r.body["user"]["email"], "admin@acme.test");
    assert!(
        r.cookies
            .iter()
            .any(|c| c.starts_with("access_token=") && c.contains("HttpOnly")),
        "{:?}",
        r.cookies
    );
    assert!(
        r.cookies
            .iter()
            .any(|c| c.starts_with("refresh_token=") && c.contains("HttpOnly")),
        "{:?}",
        r.cookies
    );
    let admin_access = r.str("/access_token");
    let admin_refresh = r.str("/refresh_token");

    let r = call(&app, get_as("/api/v1/auth/me", &admin_access).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["effective_scopes"], json!(["*"]));
    assert!(r.body["session_id"].is_string());

    // Invite a new member with a direct scope and a role. The token never shows up in the API.
    let invite = json!({ "email": "newbie@acme.test", "scopes": ["movies:read"], "role_id": ROLE_LICENSING_MANAGER });
    let r = call(
        &app,
        post_as("/api/v1/invitations", invite.clone(), &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.body);
    assert_eq!(r.body["status"], "pending");
    assert_eq!(r.body["delivered"], true);
    assert!(r.body.get("token").is_none() && r.body.get("token_hash").is_none());
    let invitation_id = r.str("/id");
    let invitation_token = outbox.last_invitation("newbie@acme.test");

    let r = call(&app, post_as("/api/v1/invitations", invite, &admin_access).to_request()).await;
    assert_eq!(r.status, StatusCode::CONFLICT, "{}", r.body);
    assert_eq!(r.code(), "INVITATION_ALREADY_PENDING");

    // The acceptance page previews the invitation by token (public; the token travels in the body).
    let lookup = json!({ "invitation_token": &invitation_token });
    let r = call(&app, post(SIGNUP_INVITATION, lookup.clone()).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["email"], "newbie@acme.test");
    assert_eq!(r.body["tenant_id"], TENANT);
    assert_eq!(r.body["tenant_name"], "ACME BROS PICTURES");
    assert_eq!(r.body["invited_by_name"], "ACME Admin");
    assert!(r.body["expires_at"].is_string());
    assert!(r.body.get("scopes").is_none() && r.body.get("role_id").is_none());
    let r = call(
        &app,
        post(
            SIGNUP_INVITATION,
            json!({ "invitation_token": "definitely-not-a-token-anyone-issued" }),
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "INVITATION_INVALID");

    // The listing filters by status.
    let r = call(
        &app,
        get_as("/api/v1/invitations?status=pending", &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 1);
    assert_eq!(r.body["items"][0]["id"], invitation_id);
    let r = call(
        &app,
        get_as("/api/v1/invitations?status=accepted", &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.body["pagination"]["total"], 0, "{}", r.body);
    let r = call(
        &app,
        get_as("/api/v1/invitations?status=bogus", &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);

    // Signup: prove the mailbox, then the invitation is accepted in one transaction.
    let signup = json!({ "email": "newbie@acme.test", "name": "New Person", "invitation_token": &invitation_token });
    let r = call(&app, post(SIGNUP_INITIATE, signup.clone()).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["tenant_id"], TENANT);
    let code = outbox.last_otp("newbie@acme.test", OtpPurpose::Signup);
    let mut verify = signup.clone();
    verify["tenant_id"] = json!(TENANT);
    verify["code"] = json!(code);
    let r = call(&app, post(SIGNUP_VERIFY, verify).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["email"], "newbie@acme.test");

    let r = call(
        &app,
        get_as(&format!("/api/v1/invitations/{invitation_id}"), &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["status"], "accepted");
    let r = call(&app, post(SIGNUP_INITIATE, signup).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "INVITATION_INVALID");
    let r = call(&app, post(SIGNUP_INVITATION, lookup).to_request()).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "{}", r.body);
    assert_eq!(r.code(), "INVITATION_INVALID");
    let r = call(
        &app,
        get_as("/api/v1/invitations?status=accepted", &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.body["pagination"]["total"], 1, "{}", r.body);
    let r = call(
        &app,
        get_as("/api/v1/invitations?status=pending", &admin_access).to_request(),
    )
    .await;
    assert_eq!(r.body["pagination"]["total"], 0, "{}", r.body);

    // The new member logs in and gets direct scopes plus role scopes.
    let newbie_access = login_with_otp(&app, &outbox, "newbie@acme.test", TENANT)
        .await
        .access_token;

    let r = call(&app, get_as("/api/v1/auth/me", &newbie_access).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["user"]["scopes"], json!(["movies:read"]));
    let effective: Vec<&str> = r.body["effective_scopes"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(Value::as_str)
        .collect();
    for scope in ["movies:read", "movies:*", "licenses:*"] {
        assert!(effective.contains(&scope), "missing {scope} in {effective:?}");
    }

    // Authorization is enforced at the service boundary.
    let r = call(&app, get_as("/api/v1/users", &newbie_access).to_request()).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN, "{}", r.body);
    assert_eq!(r.code(), "ACCESS_DENIED");
    assert_eq!(r.body["error"]["details"]["required_scope"], "users:read");
    let r = call(&app, get_as("/api/v1/users", &admin_access).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["pagination"]["total"], 3);

    // Refresh rotation and reuse detection.
    let r = call(
        &app,
        post("/api/v1/auth/refresh", json!({ "refresh_token": admin_refresh })).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let rotated_refresh = r.str("/refresh_token");
    assert_ne!(rotated_refresh, admin_refresh);
    let r = call(
        &app,
        post("/api/v1/auth/refresh", json!({ "refresh_token": admin_refresh })).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);
    assert_eq!(r.code(), "AUTH_INVALID_REFRESH_TOKEN");
    let r = call(
        &app,
        post("/api/v1/auth/refresh", json!({ "refresh_token": rotated_refresh })).to_request(),
    )
    .await;
    assert_eq!(
        r.status,
        StatusCode::UNAUTHORIZED,
        "session must be revoked after reuse: {}",
        r.body
    );
    let r = call(&app, get_as("/api/v1/auth/me", &admin_access).to_request()).await;
    assert_eq!(
        r.status,
        StatusCode::UNAUTHORIZED,
        "access token of a revoked session: {}",
        r.body
    );

    // Attempt limit on a fresh code.
    let r = call(
        &app,
        post(
            LOGIN_INITIATE,
            json!({ "email": "licensing@acme.test", "tenant_id": TENANT }),
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    for remaining in (0..5).rev() {
        let r = call(
            &app,
            post(
                LOGIN_VERIFY,
                json!({ "email": "licensing@acme.test", "tenant_id": TENANT, "code": "111111" }),
            )
            .to_request(),
        )
        .await;
        assert_eq!(r.code(), "OTP_INVALID");
        assert_eq!(r.body["error"]["details"]["attempts_remaining"], remaining);
    }
    let r = call(
        &app,
        post(
            LOGIN_VERIFY,
            json!({ "email": "licensing@acme.test", "tenant_id": TENANT, "code": "111111" }),
        )
        .to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::TOO_MANY_REQUESTS, "{}", r.body);
    assert_eq!(r.code(), "OTP_TOO_MANY_ATTEMPTS");

    // Logout clears cookies and invalidates the session.
    let r = call(&app, get_as("/api/v1/auth/sessions", &newbie_access).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.body["count"], 1);
    assert_eq!(r.body["sessions"][0]["current"], true);
    let r = call(
        &app,
        post_as("/api/v1/auth/logout", Value::Null, &newbie_access).to_request(),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert!(
        r.cookies
            .iter()
            .any(|c| c.starts_with("access_token=") && c.contains("Max-Age=0")),
        "{:?}",
        r.cookies
    );
    let r = call(&app, get_as("/api/v1/auth/me", &newbie_access).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);
}
