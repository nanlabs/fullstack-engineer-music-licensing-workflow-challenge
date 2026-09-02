mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::test as actix_test;
use actix_web::web::Data;

use backend::iam::auth::adapters::JwtTokenService;
use backend::iam::auth::{JWTConfig, TokenClaims, TokenService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::label::LabelService;
use backend::label::adapters::PostgresLabelRepository;
use backend::song::SongService;
use backend::song::adapters::PostgresSongRepository;

use common::TestDb;

fn test_jwt_config() -> JWTConfig {
    JWTConfig {
        secret_key: "test-secret-key-that-is-long-enough-for-hmac".into(),
        access_token_ttl: Duration::from_secs(900),
        refresh_token_ttl: Duration::from_secs(86400),
        issuer: "test".into(),
    }
}

struct ApiTestContext {
    label_svc: Data<LabelService>,
    song_svc: Data<SongService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let label_repo = Arc::new(PostgresLabelRepository::new(db.pool.clone()));
        let song_repo = Arc::new(PostgresSongRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));

        let label_svc = Data::new(LabelService::new(label_repo.clone(), user_repo.clone()));
        let song_svc = Data::new(SongService::new(song_repo, user_repo.clone(), label_repo));

        Self {
            label_svc,
            song_svc,
            token_svc,
            user_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_user(&self) -> User {
        let hash = self.password_svc.hash_password("password123").unwrap();
        let email = format!("{}@example.com", uuid::Uuid::new_v4());
        let mut user = User::new_with_password(email, "Test User".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    fn token_for(&self, user: &User, scopes: Vec<String>) -> String {
        let claims = TokenClaims {
            user_id: user.id.clone(),
            email: user.email.clone(),
            name: user.name.clone(),
            scopes,
        };
        self.token_svc.generate_access_token(&claims).unwrap()
    }

    fn all_label_scopes() -> Vec<String> {
        vec![
            "labels:read".into(),
            "labels:write".into(),
            "labels:delete".into(),
            "labels:members".into(),
            "songs:read".into(),
        ]
    }
}

macro_rules! build_app {
    ($ctx:expr) => {
        actix_test::init_service(
            actix_web::App::new()
                .app_data($ctx.label_svc.clone())
                .app_data($ctx.song_svc.clone())
                .app_data(Data::from($ctx.token_svc.clone() as Arc<dyn TokenService>))
                .configure(backend::label::api::configure),
        )
    };
}

// ============================================================================
// POST /labels — Create
// ============================================================================

#[actix_web::test]
async fn test_create_label() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "name": "Sony Music",
            "website": "https://sonymusic.com",
            "contact_email": "contact@sonymusic.com"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["name"], "Sony Music");
}

#[actix_web::test]
async fn test_create_label_unauthenticated() {
    let ctx = ApiTestContext::new().await;
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .set_json(serde_json::json!({ "name": "X" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_label_validation_error() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "A" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// ============================================================================
// GET /labels
// ============================================================================

#[actix_web::test]
async fn test_list_labels() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    for name in ["Label A", "Label B"] {
        let req = actix_test::TestRequest::post()
            .uri("/labels")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .set_json(serde_json::json!({ "name": name }))
            .to_request();
        actix_test::call_service(&app, req).await;
    }

    let req = actix_test::TestRequest::get()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    let names: Vec<&str> = body.iter().filter_map(|v| v["name"].as_str()).collect();
    assert!(names.contains(&"Label A"));
    assert!(names.contains(&"Label B"));
}

// ============================================================================
// GET /labels/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_label() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Get Me" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["name"], "Get Me");
}

#[actix_web::test]
async fn test_get_label_not_found() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{}", backend::kernel::LabelId::new()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// PUT /labels/{id}
// ============================================================================

#[actix_web::test]
async fn test_update_label() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Old Name" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::put()
        .uri(&format!("/labels/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "New Name" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["name"], "New Name");
}

// ============================================================================
// DELETE /labels/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_label() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Delete Me" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/labels/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// Members
// ============================================================================

#[actix_web::test]
async fn test_add_and_list_members() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Team Label" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let label_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "user_id": artist.id.as_str(),
            "role": "ARTIST"
        }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["role"], "ARTIST");
    assert_eq!(body["user_name"], "Test User");

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let members: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(members.len(), 1);
}

#[actix_web::test]
async fn test_add_member_duplicate() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Team Label" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let label_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": artist.id.as_str() }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::post()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": artist.id.as_str() }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 409);
}

#[actix_web::test]
async fn test_remove_member() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Team Label" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let label_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": artist.id.as_str() }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::delete()
        .uri(&format!(
            "/labels/{label_id}/members/{}",
            artist.id.as_str()
        ))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let members: Vec<serde_json::Value> =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    assert!(members.is_empty());
}

// ============================================================================
// GET /users/{id}/labels
// ============================================================================

#[actix_web::test]
async fn test_get_user_labels() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "Artist's Label" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let label_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/labels/{label_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": artist.id.as_str() }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/users/{}/labels", artist.id.as_str()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let labels: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(labels.len(), 1);
    assert_eq!(labels[0]["name"], "Artist's Label");
}

// ============================================================================
// GET /labels/{id}/songs
// ============================================================================

#[actix_web::test]
async fn test_list_label_songs_empty() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_label_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/labels")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "name": "No Songs" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/labels/{id}/songs"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert!(body.is_empty());
}
