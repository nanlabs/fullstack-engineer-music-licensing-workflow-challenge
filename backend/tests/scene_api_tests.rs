mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::test as actix_test;
use actix_web::web::Data;

use backend::iam::auth::adapters::JwtTokenService;
use backend::iam::auth::{JWTConfig, TokenClaims, TokenService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::SceneService;
use backend::scene::adapters::PostgresSceneRepository;
use backend::track::TrackService;
use backend::track::adapters::PostgresTrackRepository;

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
    scene_svc: Data<SceneService>,
    track_svc: Data<TrackService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    movie_repo: Arc<PostgresMovieRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let movie_repo = Arc::new(PostgresMovieRepository::new(db.pool.clone()));
        let scene_repo = Arc::new(PostgresSceneRepository::new(db.pool.clone()));
        let song_repo = Arc::new(backend::song::adapters::PostgresSongRepository::new(
            db.pool.clone(),
        ));
        let track_repo = Arc::new(PostgresTrackRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));

        let scene_svc = Data::new(SceneService::new(scene_repo.clone(), movie_repo.clone()));
        let track_svc = Data::new(TrackService::new(
            track_repo,
            scene_repo,
            song_repo,
            movie_repo.clone(),
            user_repo.clone(),
        ));

        Self {
            scene_svc,
            track_svc,
            token_svc,
            user_repo,
            movie_repo,
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

    async fn create_movie(&self, owner: &User) -> Movie {
        let movie = Movie::new("Test Movie".into(), owner.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        let member = MovieMember {
            movie_id: movie.id.clone(),
            user_id: owner.id.clone(),
            role: MovieRole::Owner,
            joined_at: chrono::Utc::now(),
        };
        self.movie_repo.add_member(&member).await.unwrap();
        movie
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

    fn all_scene_scopes() -> Vec<String> {
        vec![
            "scenes:read".into(),
            "scenes:write".into(),
            "scenes:delete".into(),
            "tracks:read".into(),
        ]
    }
}

macro_rules! build_app {
    ($ctx:expr) => {
        actix_test::init_service(
            actix_web::App::new()
                .app_data($ctx.scene_svc.clone())
                .app_data($ctx.track_svc.clone())
                .app_data(Data::from($ctx.token_svc.clone() as Arc<dyn TokenService>))
                .configure(backend::scene::api::configure),
        )
    };
}

// ============================================================================
// POST /scenes — Create
// ============================================================================

#[actix_web::test]
async fn test_create_scene() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Opening",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 120
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "Opening");
}

#[actix_web::test]
async fn test_create_scene_unauthenticated() {
    let ctx = ApiTestContext::new().await;
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .set_json(serde_json::json!({
            "movie_id": "fake",
            "title": "Opening",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 120
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_scene_not_movie_team() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let outsider = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&outsider, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Opening",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 120
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_scene_validation_error() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Opening",
            "scene_number": 1,
            "start_time": 200,
            "end_time": 100
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// ============================================================================
// GET /scenes/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_scene() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Climax",
            "scene_number": 5,
            "start_time": 0,
            "end_time": 60
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/scenes/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "Climax");
}

#[actix_web::test]
async fn test_get_scene_not_found() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/scenes/{}", backend::kernel::SceneId::new()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// PUT /scenes/{id}
// ============================================================================

#[actix_web::test]
async fn test_update_scene() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Old",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 60
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::put()
        .uri(&format!("/scenes/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "New" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "New");
}

// ============================================================================
// DELETE /scenes/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_scene() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "Delete Me",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 60
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/scenes/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/scenes/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// GET /scenes/{id}/tracks
// ============================================================================

#[actix_web::test]
async fn test_list_scene_tracks_empty() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let movie = ctx.create_movie(&owner).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_scene_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/scenes")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "movie_id": movie.id.as_str(),
            "title": "No Tracks",
            "scene_number": 1,
            "start_time": 0,
            "end_time": 60
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/scenes/{id}/tracks"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert!(body.is_empty());
}
