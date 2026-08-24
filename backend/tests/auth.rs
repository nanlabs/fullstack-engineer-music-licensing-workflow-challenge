//! Development token issuance, bearer validation, and route protection.

mod common;

use axum::http::{header, Request, StatusCode};
use common::{
    default_token, get_with_token, router_with, seeded_database, send, send_to, start_database,
    token_for, TestDatabase,
};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::json;

/// Every endpoint that must require a bearer token.
const PROTECTED_ROUTES: &[&str] = &["/movies", "/songs"];

/// Endpoints that must stay reachable without one.
const PUBLIC_ROUTES: &[&str] = &["/health/live", "/health/ready"];

async fn post_dev_token(
    database: &TestDatabase,
    body: serde_json::Value,
) -> (StatusCode, serde_json::Value) {
    let (status, _, body) = send(
        database,
        Request::builder()
            .method("POST")
            .uri("/auth/dev-token")
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(body.to_string()))
            .unwrap(),
    )
    .await;

    (status, body)
}

/// Signs a token with arbitrary claims, to forge cases the API would never mint.
fn forge(secret: &str, claims: serde_json::Value) -> String {
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("failed to sign test token")
}

const TEST_SECRET: &str = "test-secret-that-is-long-enough-to-pass";

fn valid_claims() -> serde_json::Value {
    let now = chrono::Utc::now().timestamp();
    json!({
        "sub": uuid::Uuid::new_v4(),
        "name": "Forged Actor",
        "iss": "music-licensing-api",
        "aud": "music-licensing-clients",
        "iat": now,
        "exp": now + 3600,
    })
}

#[tokio::test]
async fn issues_a_usable_token_for_a_display_name() {
    let database = seeded_database().await;

    let (status, body) = post_dev_token(&database, json!({ "name": "Ada Lovelace" })).await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["token_type"], "Bearer");
    assert_eq!(body["expires_in"], 3600);
    assert_eq!(body["actor_name"], "Ada Lovelace");

    let token = body["access_token"].as_str().unwrap();
    let (status, _, _) = get_with_token(&database, "/movies", Some(token)).await;
    assert_eq!(status, StatusCode::OK, "an issued token must be accepted");
}

#[tokio::test]
async fn the_same_name_always_resolves_to_the_same_actor_id() {
    let database = seeded_database().await;

    let (_, first) = post_dev_token(&database, json!({ "name": "Ada Lovelace" })).await;
    let (_, again) = post_dev_token(&database, json!({ "name": "  ada  LOVELACE " })).await;

    assert_eq!(
        first["actor_id"], again["actor_id"],
        "actor identity must be stable across processes and spellings"
    );
    assert_eq!(
        first["actor_name"], "Ada Lovelace",
        "the presented capitalisation is preserved"
    );
}

#[tokio::test]
async fn invalid_display_names_are_rejected() {
    let database = seeded_database().await;

    for name in ["", "   ", "\u{0007}bell", &"a".repeat(65)] {
        let (status, body) = post_dev_token(&database, json!({ "name": name })).await;

        assert_eq!(
            status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "name {name:?} should be rejected"
        );
        assert_eq!(body["code"], "validation_failed");
    }

    // The boundary itself is accepted.
    let (status, _) = post_dev_token(&database, json!({ "name": "a".repeat(64) })).await;
    assert_eq!(status, StatusCode::CREATED);
}

#[tokio::test]
async fn a_missing_token_is_rejected_with_a_challenge() {
    let database = seeded_database().await;

    for route in PROTECTED_ROUTES {
        let (status, headers, body) = get_with_token(&database, route, None).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED, "{route}");
        assert_eq!(body["code"], "invalid_token", "{route}");
        assert_eq!(
            headers.get(header::WWW_AUTHENTICATE).unwrap(),
            "Bearer",
            "{route}: a 401 must carry a challenge"
        );
    }
}

#[tokio::test]
async fn malformed_authorization_headers_are_rejected() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    for value in [
        "".to_string(),
        "Bearer".to_string(),
        "Bearer ".to_string(),
        token.clone(),                   // no scheme
        format!("Basic {token}"),        // wrong scheme
        format!("Bearer {token} extra"), // trailing junk
    ] {
        let (status, _, body) = send(
            &database,
            Request::builder()
                .uri("/movies")
                .header(header::AUTHORIZATION, &value)
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await;

        assert_eq!(status, StatusCode::UNAUTHORIZED, "header {value:?}");
        assert_eq!(body["code"], "invalid_token", "header {value:?}");
    }
}

#[tokio::test]
async fn the_bearer_scheme_is_matched_case_insensitively() {
    let database = seeded_database().await;
    let token = default_token(&database).await;

    for scheme in ["Bearer", "bearer", "BEARER"] {
        let (status, _, _) = send(
            &database,
            Request::builder()
                .uri("/movies")
                .header(header::AUTHORIZATION, format!("{scheme} {token}"))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await;

        assert_eq!(status, StatusCode::OK, "scheme `{scheme}` must be accepted");
    }
}

#[tokio::test]
async fn a_token_signed_with_another_key_is_rejected() {
    let database = seeded_database().await;

    let forged = forge("a-completely-different-secret-key-value", valid_claims());

    let (status, _, body) = get_with_token(&database, "/movies", Some(&forged)).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_token");
}

#[tokio::test]
async fn an_expired_token_is_rejected() {
    let database = seeded_database().await;

    let mut claims = valid_claims();
    let now = chrono::Utc::now().timestamp();
    claims["iat"] = json!(now - 7200);
    claims["exp"] = json!(now - 3600);

    let (status, _, body) =
        get_with_token(&database, "/movies", Some(&forge(TEST_SECRET, claims))).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_token");
}

#[tokio::test]
async fn a_token_just_inside_the_clock_skew_leeway_is_accepted() {
    let database = seeded_database().await;

    // Expired two seconds ago: within the five seconds of tolerated skew.
    let mut claims = valid_claims();
    claims["exp"] = json!(chrono::Utc::now().timestamp() - 2);

    let (status, _, _) =
        get_with_token(&database, "/movies", Some(&forge(TEST_SECRET, claims))).await;

    assert_eq!(
        status,
        StatusCode::OK,
        "a small clock difference must not lock a client out"
    );
}

#[tokio::test]
async fn tokens_from_another_issuer_or_audience_are_rejected() {
    let database = seeded_database().await;

    let mut wrong_issuer = valid_claims();
    wrong_issuer["iss"] = json!("some-other-service");

    let mut wrong_audience = valid_claims();
    wrong_audience["aud"] = json!("some-other-api");

    for (label, claims) in [("issuer", wrong_issuer), ("audience", wrong_audience)] {
        let (status, _, body) =
            get_with_token(&database, "/movies", Some(&forge(TEST_SECRET, claims))).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED, "wrong {label}");
        assert_eq!(body["code"], "invalid_token", "wrong {label}");
    }
}

#[tokio::test]
async fn tokens_missing_required_claims_are_rejected() {
    let database = seeded_database().await;

    for missing in ["sub", "iss", "aud", "exp"] {
        let mut claims = valid_claims();
        claims.as_object_mut().unwrap().remove(missing);

        let (status, _, body) =
            get_with_token(&database, "/movies", Some(&forge(TEST_SECRET, claims))).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED, "missing `{missing}`");
        assert_eq!(body["code"], "invalid_token", "missing `{missing}`");
    }
}

#[tokio::test]
async fn health_endpoints_stay_public() {
    let database = seeded_database().await;

    for route in PUBLIC_ROUTES {
        let (status, _, _) = get_with_token(&database, route, None).await;

        assert_eq!(
            status,
            StatusCode::OK,
            "{route} must answer without a token, for probes"
        );
    }
}

#[tokio::test]
async fn a_disabled_dev_token_endpoint_is_absent_rather_than_forbidden() {
    let database = seeded_database().await;

    let mut config = database.config.clone();
    config.dev_token_endpoint_enabled = false;

    let (status, _, body) = send_to(
        router_with(&database, &config),
        Request::builder()
            .method("POST")
            .uri("/auth/dev-token")
            .header(header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(json!({ "name": "Ada" }).to_string()))
            .unwrap(),
    )
    .await;

    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a disabled endpoint must not advertise its existence"
    );
    assert_eq!(body["code"], "resource_not_found");
}

#[tokio::test]
async fn development_openapi_is_generated_and_public() {
    let database = start_database().await;

    let (status, _, body) = send(
        &database,
        Request::builder()
            .uri("/api-docs/openapi.json")
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["info"]["title"], "Music Licensing Workflow API");
    assert!(body["paths"]["/tracks/{track_id}"].is_object());
}

#[tokio::test]
async fn development_documentation_is_absent_when_development_mode_is_disabled() {
    let database = start_database().await;
    let mut config = database.config.clone();
    config.dev_token_endpoint_enabled = false;

    let (status, _, body) = send_to(
        router_with(&database, &config),
        Request::builder()
            .uri("/api-docs/openapi.json")
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "resource_not_found");
}

#[tokio::test]
async fn tokens_remain_valid_when_issuance_is_disabled() {
    let database = seeded_database().await;

    // Tokens minted while issuance was on keep working: disabling issuance
    // removes the local token source, not bearer validation.
    let token = token_for(&database, "Ada Lovelace").await;

    let mut config = database.config.clone();
    config.dev_token_endpoint_enabled = false;

    let (status, _, _) = send_to(
        router_with(&database, &config),
        Request::builder()
            .uri("/movies")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
}
