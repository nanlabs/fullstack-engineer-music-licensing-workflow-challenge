mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::App;
use actix_web::test as actix_test;
use actix_web::web::Data;

use backend::iam::auth::TokenService;
use backend::iam::auth::adapters::{
    JwtTokenService, PostgresSessionRepository, PostgresTokenRepository,
};
use backend::iam::auth::api::configure as auth_routes;
use backend::iam::auth::{AuthConfig, AuthService, JWTConfig};
use backend::iam::role::adapters::PostgresRoleRepository;
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};

use common::TestDb;

fn test_auth_config() -> AuthConfig {
    AuthConfig {
        jwt: JWTConfig {
            secret_key: "test-secret-key-that-is-long-enough-for-hmac".into(),
            access_token_ttl: Duration::from_secs(900),
            refresh_token_ttl: Duration::from_secs(86400),
            issuer: "test".into(),
        },
        ..Default::default()
    }
}

struct ApiTestContext {
    auth_svc: Data<AuthService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let config = test_auth_config();
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&config.jwt));
        let token_repo = Arc::new(PostgresTokenRepository::new(db.pool.clone()));
        let session_repo = Arc::new(PostgresSessionRepository::new(db.pool.clone()));

        let auth_svc = Data::new(AuthService::new(
            user_repo.clone(),
            password_svc.clone(),
            token_svc.clone(),
            token_repo,
            session_repo,
            role_repo,
            config,
        ));

        Self {
            auth_svc,
            token_svc,
            user_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_active_user(&self, email: &str, password: &str) -> User {
        let hash = self.password_svc.hash_password(password).unwrap();
        let mut user = User::new_with_password(email.into(), "Test User".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }
}

// ============================================================================
// POST /auth/login
// ============================================================================

#[actix_web::test]
async fn test_api_login_success() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("api@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "api@example.com",
            "password": "password123"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["token_type"], "Bearer");
    assert!(!body["access_token"].as_str().unwrap().is_empty());
    assert!(!body["refresh_token"].as_str().unwrap().is_empty());
    assert!(body["expires_in"].as_i64().unwrap() > 0);
}

#[actix_web::test]
async fn test_api_login_wrong_password() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("wrong@example.com", "correct").await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .configure(auth_routes),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "wrong@example.com",
            "password": "incorrect"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["code"], "auth.invalid_credentials");
}

// ============================================================================
// POST /auth/refresh
// ============================================================================

#[actix_web::test]
async fn test_api_refresh_success() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("refresh@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // Login first
    let login_req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "refresh@example.com",
            "password": "password123"
        }))
        .to_request();
    let login_resp: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req).await).await;
    let refresh_token = login_resp["refresh_token"].as_str().unwrap();

    // Refresh
    let req = actix_test::TestRequest::post()
        .uri("/auth/refresh")
        .set_json(serde_json::json!({ "refresh_token": refresh_token }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert!(!body["access_token"].as_str().unwrap().is_empty());
    assert_ne!(body["refresh_token"].as_str().unwrap(), refresh_token);
}

#[actix_web::test]
async fn test_api_refresh_invalid_token() {
    let ctx = ApiTestContext::new().await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .configure(auth_routes),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/auth/refresh")
        .set_json(serde_json::json!({ "refresh_token": "garbage" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// ============================================================================
// POST /auth/logout
// ============================================================================

#[actix_web::test]
async fn test_api_logout_success() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("logout@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // Login
    let login_req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "logout@example.com",
            "password": "password123"
        }))
        .to_request();
    let login_resp: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req).await).await;
    let refresh_token = login_resp["refresh_token"].as_str().unwrap().to_string();

    // Logout
    let req = actix_test::TestRequest::post()
        .uri("/auth/logout")
        .set_json(serde_json::json!({ "refresh_token": &refresh_token }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Refresh with old token fails
    let req = actix_test::TestRequest::post()
        .uri("/auth/refresh")
        .set_json(serde_json::json!({ "refresh_token": &refresh_token }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// ============================================================================
// GET /auth/me
// ============================================================================

#[actix_web::test]
async fn test_api_me_authenticated() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("me@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // Login to get access token
    let login_req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "me@example.com",
            "password": "password123"
        }))
        .to_request();
    let login_resp: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req).await).await;
    let access_token = login_resp["access_token"].as_str().unwrap();

    // GET /auth/me
    let req = actix_test::TestRequest::get()
        .uri("/auth/me")
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["email"], "me@example.com");
    assert_eq!(body["name"], "Test User");
}

#[actix_web::test]
async fn test_api_me_unauthenticated() {
    let ctx = ApiTestContext::new().await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    let req = actix_test::TestRequest::get().uri("/auth/me").to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// ============================================================================
// POST /auth/logout-all
// ============================================================================

#[actix_web::test]
async fn test_api_logout_all() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("logall@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // Login twice (two sessions)
    let login_req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "logall@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp1: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req).await).await;
    let access_token = resp1["access_token"].as_str().unwrap().to_string();
    let refresh1 = resp1["refresh_token"].as_str().unwrap().to_string();

    let login_req2 = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "logall@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp2: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req2).await).await;
    let refresh2 = resp2["refresh_token"].as_str().unwrap().to_string();

    // Logout all (authenticated)
    let req = actix_test::TestRequest::post()
        .uri("/auth/logout-all")
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Both refresh tokens dead
    let req = actix_test::TestRequest::post()
        .uri("/auth/refresh")
        .set_json(serde_json::json!({ "refresh_token": &refresh1 }))
        .to_request();
    assert_eq!(actix_test::call_service(&app, req).await.status(), 401);

    let req = actix_test::TestRequest::post()
        .uri("/auth/refresh")
        .set_json(serde_json::json!({ "refresh_token": &refresh2 }))
        .to_request();
    assert_eq!(actix_test::call_service(&app, req).await.status(), 401);
}

// ============================================================================
// GET /auth/sessions + DELETE /auth/sessions/{id}
// ============================================================================

#[actix_web::test]
async fn test_api_list_and_revoke_sessions() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("sess@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // Login twice
    let login_req = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "sess@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp1: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login_req).await).await;
    let access_token = resp1["access_token"].as_str().unwrap().to_string();

    let login_req2 = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "sess@example.com",
            "password": "password123"
        }))
        .to_request();
    actix_test::call_service(&app, login_req2).await;

    // List sessions
    let req = actix_test::TestRequest::get()
        .uri("/auth/sessions")
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let sessions: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(sessions.len(), 2);

    // Revoke one session
    let session_id = sessions[0]["id"].as_str().unwrap();
    let req = actix_test::TestRequest::delete()
        .uri(&format!("/auth/sessions/{session_id}"))
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Only 1 session remains
    let req = actix_test::TestRequest::get()
        .uri("/auth/sessions")
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    let sessions: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(sessions.len(), 1);
}

#[actix_web::test]
async fn test_api_revoke_other_users_session_rejected() {
    let ctx = ApiTestContext::new().await;
    ctx.create_active_user("user1@example.com", "password123")
        .await;
    ctx.create_active_user("user2@example.com", "password123")
        .await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.auth_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(auth_routes),
    )
    .await;

    // User1 logs in
    let login1 = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "user1@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp1: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login1).await).await;
    let token1 = resp1["access_token"].as_str().unwrap().to_string();

    // User2 logs in
    let login2 = actix_test::TestRequest::post()
        .uri("/auth/login")
        .set_json(serde_json::json!({
            "email": "user2@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp2: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, login2).await).await;
    let token2 = resp2["access_token"].as_str().unwrap().to_string();

    // Get user2's session ID
    let req = actix_test::TestRequest::get()
        .uri("/auth/sessions")
        .insert_header(("Authorization", format!("Bearer {token2}")))
        .to_request();
    let sessions: Vec<serde_json::Value> =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let user2_session_id = sessions[0]["id"].as_str().unwrap();

    // User1 tries to revoke user2's session — should fail
    let req = actix_test::TestRequest::delete()
        .uri(&format!("/auth/sessions/{user2_session_id}"))
        .insert_header(("Authorization", format!("Bearer {token1}")))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}
