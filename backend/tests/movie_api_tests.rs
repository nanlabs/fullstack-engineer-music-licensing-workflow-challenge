mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::test as actix_test;
use actix_web::web::Data;

use backend::iam::auth::adapters::JwtTokenService;
use backend::iam::auth::{JWTConfig, TokenClaims, TokenService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::movie::MovieService;
use backend::movie::adapters::PostgresMovieRepository;

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
    movie_svc: Data<MovieService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let movie_repo = Arc::new(PostgresMovieRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));

        let movie_svc = Data::new(MovieService::new(movie_repo, user_repo.clone()));

        Self {
            movie_svc,
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

    fn all_movie_scopes() -> Vec<String> {
        vec![
            "movies:read".into(),
            "movies:write".into(),
            "movies:delete".into(),
            "movies:members".into(),
        ]
    }
}

macro_rules! build_app {
    ($ctx:expr) => {
        actix_test::init_service(
            actix_web::App::new()
                .app_data($ctx.movie_svc.clone())
                .app_data(Data::from($ctx.token_svc.clone() as Arc<dyn TokenService>))
                .configure(backend::movie::api::configure),
        )
    };
}

// ============================================================================
// POST /movies — Create
// ============================================================================

#[actix_web::test]
async fn test_create_movie() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());

    let app = build_app!(ctx).await;
    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "Inception",
            "description": "A mind-bending thriller",
            "release_year": 2010,
            "director": "Christopher Nolan"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "Inception");
    assert_eq!(body["director"], "Christopher Nolan");
    assert_eq!(body["created_by_name"], "Test User");
}

#[actix_web::test]
async fn test_create_movie_unauthenticated() {
    let ctx = ApiTestContext::new().await;
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .set_json(serde_json::json!({ "title": "Untitled" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_movie_missing_scope() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, vec!["movies:read".into()]);
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Untitled" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_movie_validation_error() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "   " }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// ============================================================================
// GET /movies — List / search
// ============================================================================

#[actix_web::test]
async fn test_list_movies() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    for title in ["Alpha", "Beta"] {
        let req = actix_test::TestRequest::post()
            .uri("/movies")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .set_json(serde_json::json!({ "title": title }))
            .to_request();
        actix_test::call_service(&app, req).await;
    }

    let req = actix_test::TestRequest::get()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["items"].as_array().unwrap().len(), 2);
    assert_eq!(body["pagination"]["total"], 2);
}

#[actix_web::test]
async fn test_list_movies_search() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    for title in ["Interstellar", "Inception"] {
        let req = actix_test::TestRequest::post()
            .uri("/movies")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .set_json(serde_json::json!({ "title": title }))
            .to_request();
        actix_test::call_service(&app, req).await;
    }

    let req = actix_test::TestRequest::get()
        .uri("/movies?search=incep")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["title"], "Inception");
}

// ============================================================================
// GET /movies/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_movie() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Dune" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/movies/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "Dune");
}

#[actix_web::test]
async fn test_get_movie_not_found() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/movies/{}", backend::kernel::MovieId::new()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// PUT /movies/{id}
// ============================================================================

#[actix_web::test]
async fn test_update_movie() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Old" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::put()
        .uri(&format!("/movies/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "New" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "New");
}

// ============================================================================
// DELETE /movies/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_movie() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Delete Me" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/movies/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/movies/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// GET /movies/me
// ============================================================================

#[actix_web::test]
async fn test_my_movies() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Mine" }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::get()
        .uri("/movies/me")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["title"], "Mine");
}

// ============================================================================
// Members
// ============================================================================

#[actix_web::test]
async fn test_add_and_list_members() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let other = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Team Movie" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let movie_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/movies/{movie_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "user_id": other.id.as_str(),
            "role": "EDITOR"
        }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["role"], "EDITOR");
    assert_eq!(body["user_name"], "Test User");

    let req = actix_test::TestRequest::get()
        .uri(&format!("/movies/{movie_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let members: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(members.len(), 2);
}

#[actix_web::test]
async fn test_add_member_duplicate() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Team Movie" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let movie_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/movies/{movie_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": owner.id.as_str() }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 409);
}

#[actix_web::test]
async fn test_remove_member() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let other = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_movie_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/movies")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "Team Movie" }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let movie_id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/movies/{movie_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "user_id": other.id.as_str() }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/movies/{movie_id}/members/{}", other.id.as_str()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/movies/{movie_id}/members"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let members: Vec<serde_json::Value> =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    assert_eq!(members.len(), 1);
}
