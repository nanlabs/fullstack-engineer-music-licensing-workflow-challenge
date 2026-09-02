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
use backend::label::{Label, LabelMember, LabelRepository, LabelRole};
use backend::song::SongService;
use backend::song::adapters::PostgresSongRepository;
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
    song_svc: Data<SongService>,
    track_svc: Data<TrackService>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    label_repo: Arc<PostgresLabelRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl ApiTestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let label_repo = Arc::new(PostgresLabelRepository::new(db.pool.clone()));
        let song_repo = Arc::new(PostgresSongRepository::new(db.pool.clone()));
        let track_repo = Arc::new(PostgresTrackRepository::new(db.pool.clone()));
        let movie_repo = Arc::new(backend::movie::adapters::PostgresMovieRepository::new(
            db.pool.clone(),
        ));
        let scene_repo = Arc::new(backend::scene::adapters::PostgresSceneRepository::new(
            db.pool.clone(),
        ));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));

        let song_svc = Data::new(SongService::new(
            song_repo.clone(),
            user_repo.clone(),
            label_repo.clone(),
        ));
        let track_svc = Data::new(TrackService::new(
            track_repo,
            scene_repo,
            song_repo,
            movie_repo,
            user_repo.clone(),
        ));

        Self {
            song_svc,
            track_svc,
            token_svc,
            user_repo,
            label_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_user(&self) -> User {
        let hash = self.password_svc.hash_password("password123").unwrap();
        let email = format!("{}@example.com", uuid::Uuid::new_v4());
        let mut user = User::new_with_password(email, "Test Artist".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    async fn create_label(&self) -> Label {
        let label = Label::new("Test Label".into(), None, None);
        self.label_repo.save(&label).await.unwrap();
        label
    }

    async fn add_label_artist(&self, label: &Label, artist: &User) {
        let member = LabelMember {
            label_id: label.id.clone(),
            user_id: artist.id.clone(),
            role: LabelRole::Artist,
            joined_at: chrono::Utc::now(),
        };
        self.label_repo.add_member(&member).await.unwrap();
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

    fn all_song_scopes() -> Vec<String> {
        vec![
            "songs:read".into(),
            "songs:write".into(),
            "songs:delete".into(),
        ]
    }
}

macro_rules! build_app {
    ($ctx:expr) => {
        actix_test::init_service(
            actix_web::App::new()
                .app_data($ctx.song_svc.clone())
                .app_data($ctx.track_svc.clone())
                .app_data(Data::from($ctx.token_svc.clone() as Arc<dyn TokenService>))
                .configure(backend::song::api::configure),
        )
    };
}

// ============================================================================
// POST /songs — Create
// ============================================================================

#[actix_web::test]
async fn test_create_song() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "My Song",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 200,
            "genre": "Rock"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "My Song");
    assert_eq!(body["artist_name"], "Test Artist");
}

#[actix_web::test]
async fn test_create_song_with_label() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let label = ctx.create_label().await;
    ctx.add_label_artist(&label, &artist).await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "Label Song",
            "artist_id": artist.id.as_str(),
            "label_id": label.id.as_str(),
            "duration_seconds": 180
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["label_name"], "Test Label");
}

#[actix_web::test]
async fn test_create_song_unauthenticated() {
    let ctx = ApiTestContext::new().await;
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .set_json(serde_json::json!({ "title": "x" }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_song_validation_error() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 200
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);
}

// ============================================================================
// GET /songs — List / search
// ============================================================================

#[actix_web::test]
async fn test_list_songs() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    for title in ["Song A", "Song B"] {
        let req = actix_test::TestRequest::post()
            .uri("/songs")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .set_json(serde_json::json!({
                "title": title,
                "artist_id": artist.id.as_str(),
                "duration_seconds": 100
            }))
            .to_request();
        actix_test::call_service(&app, req).await;
    }

    // Filter by our artist so seeded songs (migrations 003/004) don't count.
    let req = actix_test::TestRequest::get()
        .uri(&format!("/songs?artist_id={}", artist.id.as_str()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["items"].as_array().unwrap().len(), 2);
}

// ============================================================================
// GET /songs/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_song() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "Get Me",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 150
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/songs/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "Get Me");
}

#[actix_web::test]
async fn test_get_song_not_found() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::get()
        .uri(&format!("/songs/{}", backend::kernel::SongId::new()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// PUT /songs/{id}
// ============================================================================

#[actix_web::test]
async fn test_update_song() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "Old Title",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 150
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::put()
        .uri(&format!("/songs/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "title": "New Title" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["title"], "New Title");
    assert_eq!(body["artist_name"], "Test Artist");
}

// ============================================================================
// DELETE /songs/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_song() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "Delete Me",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 150
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/songs/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    let req = actix_test::TestRequest::get()
        .uri(&format!("/songs/{id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// GET /artists/{id}/songs
// ============================================================================

#[actix_web::test]
async fn test_list_by_artist() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let other_artist = ctx.create_user().await;
    let token = ctx.token_for(&artist, ApiTestContext::all_song_scopes());
    let app = build_app!(ctx).await;

    for (title, artist_id) in [
        ("Mine", artist.id.as_str()),
        ("Not Mine", other_artist.id.as_str()),
    ] {
        let req = actix_test::TestRequest::post()
            .uri("/songs")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .set_json(serde_json::json!({
                "title": title,
                "artist_id": artist_id,
                "duration_seconds": 100
            }))
            .to_request();
        actix_test::call_service(&app, req).await;
    }

    let req = actix_test::TestRequest::get()
        .uri(&format!("/artists/{}/songs", artist.id.as_str()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["title"], "Mine");
}

// ============================================================================
// GET /songs/{id}/tracks
// ============================================================================

#[actix_web::test]
async fn test_list_song_tracks_empty() {
    let ctx = ApiTestContext::new().await;
    let artist = ctx.create_user().await;
    let mut scopes = ApiTestContext::all_song_scopes();
    scopes.push("tracks:read".into());
    let token = ctx.token_for(&artist, scopes);
    let app = build_app!(ctx).await;

    let req = actix_test::TestRequest::post()
        .uri("/songs")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "title": "No Tracks",
            "artist_id": artist.id.as_str(),
            "duration_seconds": 100
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let id = created["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/songs/{id}/tracks"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Vec<serde_json::Value> = actix_test::read_body_json(resp).await;
    assert!(body.is_empty());
}
