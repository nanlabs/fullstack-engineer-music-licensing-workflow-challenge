mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::test as actix_test;
use actix_web::web::Data;

use backend::iam::auth::adapters::JwtTokenService;
use backend::iam::auth::{JWTConfig, TokenClaims, TokenService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::label::adapters::PostgresLabelRepository;
use backend::license::LicenseService;
use backend::license::adapters::PostgresLicenseRepository;
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::adapters::PostgresSceneRepository;
use backend::scene::{Scene, SceneRepository};
use backend::song::adapters::PostgresSongRepository;
use backend::song::{Song, SongRepository};
use backend::track::TrackService;
use backend::track::adapters::PostgresTrackRepository;
use tokio::sync::broadcast;

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
    track_svc: Data<TrackService>,
    license_svc: Data<LicenseService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    movie_repo: Arc<PostgresMovieRepository>,
    scene_repo: Arc<PostgresSceneRepository>,
    song_repo: Arc<PostgresSongRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let movie_repo = Arc::new(PostgresMovieRepository::new(db.pool.clone()));
        let scene_repo = Arc::new(PostgresSceneRepository::new(db.pool.clone()));
        let song_repo = Arc::new(PostgresSongRepository::new(db.pool.clone()));
        let track_repo = Arc::new(PostgresTrackRepository::new(db.pool.clone()));
        let label_repo = Arc::new(PostgresLabelRepository::new(db.pool.clone()));
        let license_repo = Arc::new(PostgresLicenseRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));
        let (events_tx, _) = broadcast::channel(256);

        let track_svc = Data::new(TrackService::new(
            track_repo.clone(),
            scene_repo.clone(),
            song_repo.clone(),
            movie_repo.clone(),
            user_repo.clone(),
        ));
        let license_svc = Data::new(LicenseService::new(
            license_repo,
            track_repo,
            scene_repo.clone(),
            movie_repo.clone(),
            song_repo.clone(),
            label_repo,
            user_repo.clone(),
            events_tx,
        ));

        Self {
            track_svc,
            license_svc,
            token_svc,
            user_repo,
            movie_repo,
            scene_repo,
            song_repo,
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

    /// Sets up a movie (owned by `owner`), scene, and song (by `artist`).
    async fn setup_scene_and_song(&self, owner: &User, artist: &User) -> (Scene, Song) {
        let movie = Movie::new("Test Movie".into(), owner.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        let member = MovieMember {
            movie_id: movie.id.clone(),
            user_id: owner.id.clone(),
            role: MovieRole::Owner,
            joined_at: chrono::Utc::now(),
        };
        self.movie_repo.add_member(&member).await.unwrap();
        let scene = Scene::new(movie.id.clone(), "Opening".into(), 1, 0, 120);
        self.scene_repo.save(&scene).await.unwrap();
        let song = Song::new("Test Song".into(), artist.id.clone(), None, 240);
        self.song_repo.save(&song).await.unwrap();
        (scene, song)
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

    fn all_track_scopes() -> Vec<String> {
        vec![
            "tracks:read".into(),
            "tracks:write".into(),
            "tracks:delete".into(),
            "licenses:read".into(),
        ]
    }
}

macro_rules! build_app {
    ($ctx:expr) => {
        actix_test::init_service(
            actix_web::App::new()
                .app_data($ctx.track_svc.clone())
                .app_data($ctx.license_svc.clone())
                .app_data(Data::from($ctx.token_svc.clone() as Arc<dyn TokenService>))
                .configure(backend::track::api::configure),
        )
    };
}

// ============================================================================
// POST /tracks — Create
// ============================================================================

#[actix_web::test]
async fn test_create_track() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["usage_type"], "BACKGROUND");
    assert_eq!(body["created_by_name"], "Test User");
}

#[actix_web::test]
async fn test_create_track_unauthenticated() {
    let ctx = ApiTestContext::new().await;
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .set_json(serde_json::json!({
            "scene_id": "fake",
            "song_id": "fake",
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_track_not_movie_team() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let outsider = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&outsider, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_track_validation_error() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 30,
            "end_time_seconds": 10
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// ============================================================================
// GET /tracks/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_track() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "FEATURED",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/tracks/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["usage_type"], "FEATURED");
}

#[actix_web::test]
async fn test_get_track_not_found() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/tracks/{}", backend::kernel::TrackId::new()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// PUT /tracks/{id}
// ============================================================================

#[actix_web::test]
async fn test_update_track() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::put()
        .uri(&format!("/tracks/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "usage_type": "TRAILER" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["usage_type"], "TRAILER");
}

// ============================================================================
// DELETE /tracks/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_track() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/tracks/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/tracks/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// GET /tracks/{id}/license
// ============================================================================

#[actix_web::test]
async fn test_get_track_license_none() {
    let ctx = ApiTestContext::new().await;
    let owner = ctx.create_user().await;
    let artist = ctx.create_user().await;
    let (scene, song) = ctx.setup_scene_and_song(&owner, &artist).await;
    let token = ctx.token_for(&owner, ApiTestContext::all_track_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/tracks")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "scene_id": scene.id.as_str(),
            "song_id": song.id.as_str(),
            "usage_type": "BACKGROUND",
            "start_time_seconds": 0,
            "end_time_seconds": 30
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/tracks/{id}/license"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert!(body.is_null());
}
