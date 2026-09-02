mod common;

use std::sync::Arc;
use std::time::Duration;

use actix_web::App;
use actix_web::test as actix_test;
use actix_web::web::Data;
use tokio::sync::broadcast;

use backend::iam::auth::adapters::JwtTokenService;
use backend::iam::auth::{JWTConfig, TokenClaims, TokenService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::UserId;
use backend::label::adapters::PostgresLabelRepository;
use backend::label::{Label, LabelMember, LabelRepository, LabelRole};
use backend::license::adapters::PostgresLicenseRepository;
use backend::license::{LicenseEvent, LicenseService};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::adapters::PostgresSceneRepository;
use backend::scene::{Scene, SceneRepository};
use backend::song::adapters::PostgresSongRepository;
use backend::song::{Song, SongRepository};
use backend::track::adapters::PostgresTrackRepository;
use backend::track::{Track, TrackRepository, UsageType};

use common::TestDb;

// ============================================================================
// Test Context
// ============================================================================

fn test_jwt_config() -> JWTConfig {
    JWTConfig {
        secret_key: "test-secret-key-that-is-long-enough-for-hmac".into(),
        access_token_ttl: Duration::from_secs(900),
        refresh_token_ttl: Duration::from_secs(86400),
        issuer: "test".into(),
    }
}

struct ApiTestContext {
    license_svc: Data<LicenseService>,
    events_tx: broadcast::Sender<LicenseEvent>,
    token_svc: Arc<JwtTokenService>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    movie_repo: Arc<PostgresMovieRepository>,
    scene_repo: Arc<PostgresSceneRepository>,
    song_repo: Arc<PostgresSongRepository>,
    track_repo: Arc<PostgresTrackRepository>,
    label_repo: Arc<PostgresLabelRepository>,
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
        let license_repo = Arc::new(PostgresLicenseRepository::new(db.pool.clone()));
        let label_repo = Arc::new(PostgresLabelRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&test_jwt_config()));
        let (events_tx, _) = broadcast::channel::<LicenseEvent>(256);

        let license_svc = Data::new(LicenseService::new(
            license_repo,
            track_repo.clone(),
            scene_repo.clone(),
            movie_repo.clone(),
            song_repo.clone(),
            label_repo.clone(),
            user_repo.clone(),
            events_tx.clone(),
        ));

        Self {
            license_svc,
            events_tx,
            token_svc,
            user_repo,
            password_svc,
            movie_repo,
            scene_repo,
            song_repo,
            track_repo,
            label_repo,
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

    fn all_license_scopes() -> Vec<String> {
        vec![
            "licenses:read".into(),
            "licenses:write".into(),
            "licenses:negotiate".into(),
            "licenses:delete".into(),
        ]
    }

    async fn setup_track(&self) -> (Track, User, User) {
        let owner = self.create_user().await;
        let artist = self.create_user().await;
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
        let track = Track::new(
            scene.id.clone(),
            song.id.clone(),
            UsageType::Background,
            0,
            60,
            owner.id.clone(),
        );
        self.track_repo.save(&track).await.unwrap();
        (track, owner, artist)
    }

    async fn setup_track_with_label(&self) -> (Track, User, User) {
        let owner = self.create_user().await;
        let artist = self.create_user().await;
        let label_rep = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), owner.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        let member = MovieMember {
            movie_id: movie.id.clone(),
            user_id: owner.id.clone(),
            role: MovieRole::Owner,
            joined_at: chrono::Utc::now(),
        };
        self.movie_repo.add_member(&member).await.unwrap();
        let label = Label::new("Test Label".into(), None, None);
        self.label_repo.save(&label).await.unwrap();
        let label_member = LabelMember {
            label_id: label.id.clone(),
            user_id: label_rep.id.clone(),
            role: LabelRole::Rep,
            joined_at: chrono::Utc::now(),
        };
        self.label_repo.add_member(&label_member).await.unwrap();
        let scene = Scene::new(movie.id.clone(), "Scene".into(), 1, 0, 120);
        self.scene_repo.save(&scene).await.unwrap();
        let song = Song::new(
            "Label Song".into(),
            artist.id.clone(),
            Some(label.id.clone()),
            240,
        );
        self.song_repo.save(&song).await.unwrap();
        let track = Track::new(
            scene.id.clone(),
            song.id.clone(),
            UsageType::Background,
            0,
            60,
            owner.id.clone(),
        );
        self.track_repo.save(&track).await.unwrap();
        (track, owner, label_rep)
    }
}

// ============================================================================
// POST /licenses — Create
// ============================================================================

#[actix_web::test]
async fn test_create_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0,
            "currency": "USD"
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["license"]["status"], "DRAFT");
    assert_eq!(body["offer"]["offer_number"], 1);
    assert_eq!(body["offer"]["license_fee"], 5000.0);
    assert_eq!(body["offer"]["currency"], "USD");
}

#[actix_web::test]
async fn test_create_license_unauthenticated() {
    let ctx = ApiTestContext::new().await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .set_json(serde_json::json!({
            "track_id": "fake-id",
            "terms": {}
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_license_missing_scope() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, vec!["licenses:read".into()]);

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();

    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_create_license_duplicate() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;
    let body = serde_json::json!({
        "track_id": track.id.as_str(),
        "terms": {}
    });

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(&body)
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(&body)
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 409);

    let err: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(err["code"], "license.already_exists");
}

// ============================================================================
// GET /licenses/{id}
// ============================================================================

#[actix_web::test]
async fn test_get_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create first
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    // Get
    let req = actix_test::TestRequest::get()
        .uri(&format!("/licenses/{license_id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["id"], license_id);
    assert_eq!(body["status"], "DRAFT");
}

#[actix_web::test]
async fn test_get_license_not_found() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;
    let req = actix_test::TestRequest::get()
        .uri(&format!("/licenses/{}", UserId::new().as_str()))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ============================================================================
// GET /licenses/{id}/offers
// ============================================================================

#[actix_web::test]
async fn test_list_offers() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 1000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::get()
        .uri(&format!("/licenses/{license_id}/offers"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    let offers = body.as_array().unwrap();
    assert_eq!(offers.len(), 1);
    assert_eq!(offers[0]["offer_number"], 1);
    assert_eq!(offers[0]["side"], "MOVIE_TEAM");
}

// ============================================================================
// POST /licenses/{id}/revise
// ============================================================================

#[actix_web::test]
async fn test_revise_draft() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/revise"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "license_fee": 7500.0,
            "currency": "EUR"
        }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["license_fee"], 7500.0);
    assert_eq!(body["currency"], "EUR");
    assert_eq!(body["offer_number"], 2);
}

// ============================================================================
// POST /licenses/{id}/submit
// ============================================================================

#[actix_web::test]
async fn test_submit_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["status"], "REQUESTED");
}

// ============================================================================
// POST /licenses/{id}/counter
// ============================================================================

#[actix_web::test]
async fn test_counter_offer() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Artist counters
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/counter"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({
            "license_fee": 8000.0,
            "currency": "USD",
            "territory": "Worldwide"
        }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["side"], "RIGHTS_HOLDER");
    assert_eq!(body["license_fee"], 8000.0);
    assert_eq!(body["offer_number"], 2);
}

#[actix_web::test]
async fn test_counter_own_offer_fails() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Owner tries to counter own offer
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/counter"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({ "license_fee": 1.0 }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 422);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["code"], "license.own_offer");
}

// ============================================================================
// POST /licenses/{id}/accept
// ============================================================================

#[actix_web::test]
async fn test_accept_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Artist accepts
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["status"], "APPROVED");
    assert!(body["resolved_by"].as_str().is_some());
    assert!(body["resolved_at"].as_str().is_some());
}

#[actix_web::test]
async fn test_accept_own_offer_fails() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 422);
}

// ============================================================================
// POST /licenses/{id}/reject
// ============================================================================

#[actix_web::test]
async fn test_reject_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Artist rejects
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/reject"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({ "reason": "Too expensive" }))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["status"], "REJECTED");
    assert_eq!(body["rejection_reason"], "Too expensive");
}

// ============================================================================
// POST /licenses/{id}/cancel
// ============================================================================

#[actix_web::test]
async fn test_cancel_license() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    // Submit first
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Cancel
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/cancel"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["status"], "CANCELLED");
}

#[actix_web::test]
async fn test_cancel_by_artist_fails() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/cancel"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

// ============================================================================
// DELETE /licenses/{id}
// ============================================================================

#[actix_web::test]
async fn test_delete_draft() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/licenses/{license_id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 204);

    // Confirm gone
    let req = actix_test::TestRequest::get()
        .uri(&format!("/licenses/{license_id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
async fn test_delete_submitted_fails() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let req = actix_test::TestRequest::delete()
        .uri(&format!("/licenses/{license_id}"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 422);
}

// ============================================================================
// Full negotiation flow: create → submit → counter → accept
// ============================================================================

#[actix_web::test]
async fn test_full_negotiation_flow() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // 1. Create
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0, "currency": "USD"
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();
    assert_eq!(created["license"]["status"], "DRAFT");

    // 2. Submit
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    let resp: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    assert_eq!(resp["status"], "REQUESTED");

    // 3. Artist counters
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/counter"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({
            "license_fee": 8000.0,
            "currency": "USD",
            "territory": "Worldwide"
        }))
        .to_request();
    let counter: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    assert_eq!(counter["side"], "RIGHTS_HOLDER");
    assert_eq!(counter["offer_number"], 2);

    // 4. Owner accepts the counter
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    let accepted: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    assert_eq!(accepted["status"], "APPROVED");

    // 5. Check offers history
    let req = actix_test::TestRequest::get()
        .uri(&format!("/licenses/{license_id}/offers"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    let offers: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let offers = offers.as_array().unwrap();
    assert_eq!(offers.len(), 2);
    assert_eq!(offers[0]["side"], "MOVIE_TEAM");
    assert_eq!(offers[1]["side"], "RIGHTS_HOLDER");
}

// ============================================================================
// Full flow with label
// ============================================================================

#[actix_web::test]
async fn test_negotiation_with_label_rep() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, label_rep) = ctx.setup_track_with_label().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let rep_token = ctx.token_for(&label_rep, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 10000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Label rep accepts
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {rep_token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: serde_json::Value = actix_test::read_body_json(resp).await;
    assert_eq!(body["status"], "APPROVED");
}

// ============================================================================
// SSE: /licenses/events — Event streaming
// ============================================================================

#[actix_web::test]
async fn test_sse_submit_event() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    // Subscribe before performing the action
    let mut rx = ctx.events_tx.subscribe();

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Verify event was emitted
    let event = rx.try_recv().unwrap();
    assert_eq!(event.license_id.as_str(), license_id);
    assert_eq!(event.track_id, track.id);
    let kind_json = serde_json::to_value(&event.kind).unwrap();
    assert_eq!(kind_json, "submitted");
}

#[actix_web::test]
async fn test_sse_counter_offer_event() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    // Subscribe after submit (only interested in counter event)
    let mut rx = ctx.events_tx.subscribe();

    // Counter
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/counter"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({ "license_fee": 8000.0 }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let event = rx.try_recv().unwrap();
    let kind_json = serde_json::to_value(&event.kind).unwrap();
    assert_eq!(kind_json, "counter_offer");
    assert_eq!(event.actor, artist.id);
}

#[actix_web::test]
async fn test_sse_accept_event() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create + submit
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let mut rx = ctx.events_tx.subscribe();

    // Accept
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let event = rx.try_recv().unwrap();
    let kind_json = serde_json::to_value(&event.kind).unwrap();
    assert_eq!(kind_json, "accepted");
    assert_eq!(event.actor, artist.id);
}

#[actix_web::test]
async fn test_sse_reject_event() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let mut rx = ctx.events_tx.subscribe();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/reject"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({ "reason": "No way" }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let event = rx.try_recv().unwrap();
    let kind_json = serde_json::to_value(&event.kind).unwrap();
    assert_eq!(kind_json, "rejected");
}

#[actix_web::test]
async fn test_sse_cancel_event() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, _) = ctx.setup_track().await;
    let token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "terms": {}
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let mut rx = ctx.events_tx.subscribe();

    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/cancel"))
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let event = rx.try_recv().unwrap();
    let kind_json = serde_json::to_value(&event.kind).unwrap();
    assert_eq!(kind_json, "cancelled");
}

#[actix_web::test]
async fn test_sse_full_negotiation_events() {
    let ctx = ApiTestContext::new().await;
    let (track, owner, artist) = ctx.setup_track().await;
    let owner_token = ctx.token_for(&owner, ApiTestContext::all_license_scopes());
    let artist_token = ctx.token_for(&artist, ApiTestContext::all_license_scopes());

    let mut rx = ctx.events_tx.subscribe();

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    // Create (no event)
    let req = actix_test::TestRequest::post()
        .uri("/licenses")
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .set_json(serde_json::json!({
            "track_id": track.id.as_str(),
            "license_fee": 5000.0
        }))
        .to_request();
    let created: serde_json::Value =
        actix_test::read_body_json(actix_test::call_service(&app, req).await).await;
    let license_id = created["license"]["id"].as_str().unwrap();

    // No event for create
    assert!(rx.try_recv().is_err());

    // Submit
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/submit"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let e = rx.try_recv().unwrap();
    assert_eq!(serde_json::to_value(&e.kind).unwrap(), "submitted");
    assert_eq!(e.actor, owner.id);

    // Counter
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/counter"))
        .insert_header(("Authorization", format!("Bearer {artist_token}")))
        .set_json(serde_json::json!({ "license_fee": 8000.0 }))
        .to_request();
    actix_test::call_service(&app, req).await;

    let e = rx.try_recv().unwrap();
    assert_eq!(serde_json::to_value(&e.kind).unwrap(), "counter_offer");
    assert_eq!(e.actor, artist.id);

    // Accept
    let req = actix_test::TestRequest::post()
        .uri(&format!("/licenses/{license_id}/accept"))
        .insert_header(("Authorization", format!("Bearer {owner_token}")))
        .to_request();
    actix_test::call_service(&app, req).await;

    let e = rx.try_recv().unwrap();
    assert_eq!(serde_json::to_value(&e.kind).unwrap(), "accepted");
    assert_eq!(e.actor, owner.id);

    // No more events
    assert!(rx.try_recv().is_err());
}

// ============================================================================
// SSE endpoint: GET /licenses/events — HTTP response format
// ============================================================================

#[actix_web::test]
async fn test_sse_endpoint_content_type() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let content_type = resp
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(content_type.contains("text/event-stream"));

    let cache_control = resp
        .headers()
        .get("cache-control")
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(cache_control, "no-cache");
}

#[actix_web::test]
async fn test_sse_endpoint_unauthenticated() {
    let ctx = ApiTestContext::new().await;

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_sse_content_encoding_identity() {
    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let encoding = resp
        .headers()
        .get("content-encoding")
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(
        encoding, "identity",
        "SSE must bypass compression to avoid buffering"
    );
}

#[actix_web::test]
async fn test_sse_stream_event_format() {
    use actix_web::body::MessageBody;
    use backend::license::LicenseEventKind;
    use std::pin::Pin;

    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // Send event after the handler has subscribed
    let event = LicenseEvent {
        license_id: backend::kernel::LicenseRequestId::new(),
        track_id: backend::kernel::TrackId::new(),
        kind: LicenseEventKind::Submitted,
        actor: user.id.clone(),
        actor_name: user.name.clone(),
        timestamp: chrono::Utc::now(),
    };
    ctx.events_tx.send(event).unwrap();

    let mut body = resp.into_body();
    let chunk_fut = futures::future::poll_fn(|cx| Pin::new(&mut body).poll_next(cx));
    let chunk = tokio::time::timeout(Duration::from_secs(2), chunk_fut)
        .await
        .expect("event should arrive within 2s");

    if let Some(Ok(bytes)) = chunk {
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        assert!(
            text.starts_with("data: "),
            "SSE frame must start with 'data: '"
        );
        assert!(text.contains("\"kind\":\"submitted\""));
        assert!(text.contains(&format!("\"actor_name\":\"{}\"", user.name)));
        assert!(
            text.ends_with("\n\n"),
            "SSE frame must end with double newline"
        );
    } else {
        panic!("expected an event chunk from the SSE stream");
    }
}

#[actix_web::test]
#[ignore] // Takes ~30s to wait for heartbeat; run with: cargo test -- --ignored
async fn test_sse_heartbeat_arrives() {
    use actix_web::body::MessageBody;
    use std::pin::Pin;

    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let mut body = resp.into_body();
    let chunk_fut = futures::future::poll_fn(|cx| Pin::new(&mut body).poll_next(cx));
    let chunk = tokio::time::timeout(Duration::from_secs(35), chunk_fut)
        .await
        .expect("heartbeat should arrive within 35s");

    if let Some(Ok(bytes)) = chunk {
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        assert_eq!(text, ": keepalive\n\n");
    } else {
        panic!("expected a heartbeat chunk from the SSE stream");
    }
}

#[actix_web::test]
async fn test_sse_event_before_heartbeat() {
    use actix_web::body::MessageBody;
    use backend::license::LicenseEventKind;
    use std::pin::Pin;

    let ctx = ApiTestContext::new().await;
    let user = ctx.create_user().await;
    let token = ctx.token_for(&user, ApiTestContext::all_license_scopes());

    let app = actix_test::init_service(
        App::new()
            .app_data(ctx.license_svc.clone())
            .app_data(Data::from(ctx.token_svc.clone() as Arc<dyn TokenService>))
            .configure(backend::license::api::configure),
    )
    .await;

    let req = actix_test::TestRequest::get()
        .uri("/licenses/events")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = actix_test::call_service(&app, req).await;

    // Send an event — should arrive before the 30s heartbeat
    let event = LicenseEvent {
        license_id: backend::kernel::LicenseRequestId::new(),
        track_id: backend::kernel::TrackId::new(),
        kind: LicenseEventKind::Accepted,
        actor: user.id.clone(),
        actor_name: user.name.clone(),
        timestamp: chrono::Utc::now(),
    };
    ctx.events_tx.send(event).unwrap();

    let mut body = resp.into_body();
    let chunk_fut = futures::future::poll_fn(|cx| Pin::new(&mut body).poll_next(cx));
    let chunk = tokio::time::timeout(Duration::from_secs(2), chunk_fut)
        .await
        .expect("event should arrive within 2s");

    if let Some(Ok(bytes)) = chunk {
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        assert!(
            text.starts_with("data: "),
            "should be a data frame, not a keepalive"
        );
        assert!(text.contains("\"kind\":\"accepted\""));
    } else {
        panic!("expected an event chunk from the SSE stream");
    }
}
