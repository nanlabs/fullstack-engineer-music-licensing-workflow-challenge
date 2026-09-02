mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::{LicenseRequestId, TrackId};
use backend::label::adapters::PostgresLabelRepository;
use backend::label::{Label, LabelMember, LabelRepository, LabelRole};
use backend::license::adapters::PostgresLicenseRepository;
use backend::license::{
    CreateLicenseRequest, LicenseRepository, LicenseService, LicenseStatus, NegotiationSide,
    OfferTerms,
};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::adapters::PostgresSceneRepository;
use backend::scene::{Scene, SceneRepository};
use backend::song::adapters::PostgresSongRepository;
use backend::song::{Song, SongRepository};
use backend::track::adapters::PostgresTrackRepository;
use backend::track::{Track, TrackRepository, UsageType};
use tokio::sync::broadcast;

use common::TestDb;

struct TestContext {
    license_svc: LicenseService,
    license_repo: Arc<PostgresLicenseRepository>,
    track_repo: Arc<PostgresTrackRepository>,
    scene_repo: Arc<PostgresSceneRepository>,
    song_repo: Arc<PostgresSongRepository>,
    movie_repo: Arc<PostgresMovieRepository>,
    label_repo: Arc<PostgresLabelRepository>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl TestContext {
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
        let license_svc = LicenseService::new(
            license_repo.clone(),
            track_repo.clone(),
            scene_repo.clone(),
            movie_repo.clone(),
            song_repo.clone(),
            label_repo.clone(),
            user_repo.clone(),
            broadcast::channel(16).0,
        );

        Self {
            license_svc,
            license_repo,
            track_repo,
            scene_repo,
            song_repo,
            movie_repo,
            label_repo,
            user_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_user(&self) -> User {
        let hash = self.password_svc.hash_password("password123").unwrap();
        let email = format!("{}@example.com", uuid::Uuid::new_v4());
        let mut user = User::new_with_password(email, "Test".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    /// Creates a movie with an owner, a scene, a song by a separate artist, and a track.
    /// Returns (track, movie_owner, artist, movie).
    async fn setup_track(&self) -> (Track, User, User, Movie) {
        let owner = self.create_user().await;
        let artist = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), owner.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        self.add_movie_member(&movie, &owner, MovieRole::Owner)
            .await;
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
        (track, owner, artist, movie)
    }

    /// Creates a track whose song belongs to a label, returns (track, movie_owner, label_rep, movie).
    async fn setup_track_with_label(&self) -> (Track, User, User, Movie) {
        let owner = self.create_user().await;
        let artist = self.create_user().await;
        let label_rep = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), owner.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        self.add_movie_member(&movie, &owner, MovieRole::Owner)
            .await;
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
        (track, owner, label_rep, movie)
    }

    async fn add_movie_member(&self, movie: &Movie, user: &User, role: MovieRole) {
        let member = MovieMember {
            movie_id: movie.id.clone(),
            user_id: user.id.clone(),
            role,
            joined_at: chrono::Utc::now(),
        };
        self.movie_repo.add_member(&member).await.unwrap();
    }

    fn terms(fee: Option<f64>) -> OfferTerms {
        OfferTerms {
            license_fee: fee,
            currency: fee.map(|_| "USD".into()),
            territory: None,
            media_rights: None,
            license_start: None,
            license_end: None,
            exclusive: None,
            notes: None,
        }
    }

    fn create_license_req(&self, track_id: TrackId) -> CreateLicenseRequest {
        CreateLicenseRequest {
            track_id,
            terms: Self::terms(None),
        }
    }

    /// Create + submit: the movie team's offer is on the table.
    async fn requested(&self, track: &Track, owner: &User) -> backend::license::LicenseRequest {
        let (license, _) = self
            .license_svc
            .create_license(self.create_license_req(track.id.clone()), owner.id.clone())
            .await
            .unwrap();
        self.license_svc
            .submit(&license.id, owner.id.clone())
            .await
            .unwrap()
    }
}

// ============================================================================
// Repository: CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    let found = ctx
        .license_repo
        .get_by_id(&license.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.track_id, track.id);
    assert_eq!(found.status, LicenseStatus::Draft);
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx
        .license_repo
        .get_by_id(&LicenseRequestId::new())
        .await
        .unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;

    let mut license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    license.status = LicenseStatus::Requested;
    license.resolved_by = Some(artist.id.clone());
    license.resolved_at = Some(chrono::Utc::now());
    license.rejection_reason = Some("test".into());
    ctx.license_repo.update(&license).await.unwrap();

    let found = ctx
        .license_repo
        .get_by_id(&license.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.status, LicenseStatus::Requested);
    assert_eq!(found.resolved_by, Some(artist.id));
    assert!(found.resolved_at.is_some());
    assert_eq!(found.rejection_reason.as_deref(), Some("test"));
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();
    ctx.license_repo.delete(&license.id).await.unwrap();
    assert!(
        ctx.license_repo
            .get_by_id(&license.id)
            .await
            .unwrap()
            .is_none()
    );
}

#[tokio::test]
async fn test_repo_get_by_track() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    let found = ctx
        .license_repo
        .get_by_track(&track.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.id, license.id);
}

#[tokio::test]
async fn test_repo_list_by_track() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    let list = ctx.license_repo.list_by_track(&track.id).await.unwrap();
    assert_eq!(list.len(), 1);
}

// ============================================================================
// Repository: Offers
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_list_offers() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    let o1 = backend::license::LicenseOffer::new(
        license.id.clone(),
        1,
        NegotiationSide::MovieTeam,
        owner.id.clone(),
    );
    ctx.license_repo.save_offer(&o1).await.unwrap();

    let mut o2 = backend::license::LicenseOffer::new(
        license.id.clone(),
        2,
        NegotiationSide::RightsHolder,
        artist.id.clone(),
    );
    o2.license_fee = Some(5000.0);
    o2.currency = Some("USD".into());
    o2.exclusive = true;
    ctx.license_repo.save_offer(&o2).await.unwrap();

    let offers = ctx.license_repo.list_offers(&license.id).await.unwrap();
    assert_eq!(offers.len(), 2);
    assert_eq!(offers[0].offer_number, 1);
    assert_eq!(offers[0].side, NegotiationSide::MovieTeam);
    assert_eq!(offers[1].offer_number, 2);
    assert_eq!(offers[1].side, NegotiationSide::RightsHolder);
    assert_eq!(offers[1].license_fee, Some(5000.0));
    assert!(offers[1].exclusive);
}

#[tokio::test]
async fn test_repo_get_latest_offer() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    ctx.license_repo.save(&license).await.unwrap();

    let o1 = backend::license::LicenseOffer::new(
        license.id.clone(),
        1,
        NegotiationSide::MovieTeam,
        owner.id.clone(),
    );
    ctx.license_repo.save_offer(&o1).await.unwrap();

    let mut o2 = backend::license::LicenseOffer::new(
        license.id.clone(),
        2,
        NegotiationSide::RightsHolder,
        owner.id.clone(),
    );
    o2.license_fee = Some(9999.0);
    ctx.license_repo.save_offer(&o2).await.unwrap();

    let latest = ctx
        .license_repo
        .get_latest_offer(&license.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(latest.offer_number, 2);
    assert_eq!(latest.license_fee, Some(9999.0));
}

#[tokio::test]
async fn test_repo_save_with_offer_rolls_back_on_offer_failure() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let license = backend::license::LicenseRequest::new(track.id.clone(), owner.id.clone());
    // Nonexistent proposer -> FK violation on the offer insert, inside the tx.
    let bad_offer = backend::license::LicenseOffer::new(
        license.id.clone(),
        1,
        NegotiationSide::MovieTeam,
        backend::kernel::UserId::new(),
    );
    let result = ctx.license_repo.save_with_offer(&license, &bad_offer).await;
    assert!(result.is_err());

    // The request insert must have been rolled back too — no orphan request.
    assert!(
        ctx.license_repo
            .get_by_id(&license.id)
            .await
            .unwrap()
            .is_none()
    );
}

// ============================================================================
// Service: Create
// ============================================================================

#[tokio::test]
async fn test_service_create_license() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let (license, offer) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    assert_eq!(license.track_id, track.id);
    assert_eq!(license.status, LicenseStatus::Draft);
    assert_eq!(offer.offer_number, 1);
    assert_eq!(offer.side, NegotiationSide::MovieTeam);
    assert_eq!(offer.proposed_by, owner.id);
}

#[tokio::test]
async fn test_service_create_license_with_terms() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;

    let req = CreateLicenseRequest {
        track_id: track.id.clone(),
        terms: OfferTerms {
            license_fee: Some(10000.0),
            currency: Some("EUR".into()),
            territory: Some("Worldwide".into()),
            media_rights: None,
            license_start: None,
            license_end: None,
            exclusive: Some(true),
            notes: None,
        },
    };
    let (_, offer) = ctx
        .license_svc
        .create_license(req, owner.id.clone())
        .await
        .unwrap();
    assert_eq!(offer.license_fee, Some(10000.0));
    assert_eq!(offer.currency.as_deref(), Some("EUR"));
    assert!(offer.exclusive);
}

#[tokio::test]
async fn test_service_create_license_track_not_found() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user().await;
    let err = ctx
        .license_svc
        .create_license(ctx.create_license_req(TrackId::new()), user.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_license_by_artist_fails() {
    let ctx = TestContext::new().await;
    let (track, _, artist, _) = ctx.setup_track().await;
    let err = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

#[tokio::test]
async fn test_service_create_license_duplicate() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    ctx.license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.already_exists");
}

// ============================================================================
// Service: Draft revision + submit
// ============================================================================

#[tokio::test]
async fn test_service_revise_draft() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let offer = ctx
        .license_svc
        .revise_draft(
            &license.id,
            TestContext::terms(Some(7500.0)),
            owner.id.clone(),
        )
        .await
        .unwrap();
    assert_eq!(offer.offer_number, 2);
    assert_eq!(offer.side, NegotiationSide::MovieTeam);
    assert_eq!(offer.license_fee, Some(7500.0));
}

#[tokio::test]
async fn test_service_revise_after_submit_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let err = ctx
        .license_svc
        .revise_draft(&license.id, TestContext::terms(Some(1.0)), owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_submit() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    assert_eq!(license.status, LicenseStatus::Requested);
}

#[tokio::test]
async fn test_service_submit_twice_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let err = ctx
        .license_svc
        .submit(&license.id, owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_submit_by_artist_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .submit(&license.id, artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

// ============================================================================
// Service: Counter-offers
// ============================================================================

#[tokio::test]
async fn test_service_counter_offer_by_artist() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let offer = ctx
        .license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(8000.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    assert_eq!(offer.offer_number, 2);
    assert_eq!(offer.side, NegotiationSide::RightsHolder);
    assert_eq!(offer.proposed_by, artist.id);
}

#[tokio::test]
async fn test_service_counter_offer_back_and_forth() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(8000.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    let offer = ctx
        .license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(7000.0)),
            owner.id.clone(),
        )
        .await
        .unwrap();
    assert_eq!(offer.offer_number, 3);
    assert_eq!(offer.side, NegotiationSide::MovieTeam);
}

#[tokio::test]
async fn test_service_counter_own_offer_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    // Movie team made the latest offer — it cannot counter itself.
    let err = ctx
        .license_svc
        .counter_offer(&license.id, TestContext::terms(Some(1.0)), owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.own_offer");
}

#[tokio::test]
async fn test_service_counter_offer_in_draft_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(1.0)),
            artist.id.clone(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_counter_offer_outsider_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let outsider = ctx.create_user().await;
    let err = ctx
        .license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(1.0)),
            outsider.id.clone(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

// ============================================================================
// Service: Accept
// ============================================================================

#[tokio::test]
async fn test_service_accept_by_artist() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let approved = ctx
        .license_svc
        .accept(&license.id, artist.id.clone())
        .await
        .unwrap();
    assert_eq!(approved.status, LicenseStatus::Approved);
    assert_eq!(approved.resolved_by, Some(artist.id));
    assert!(approved.resolved_at.is_some());
}

#[tokio::test]
async fn test_service_accept_by_movie_after_counter() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(9000.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    // Rights holder's counter is on the table — movie team can accept it.
    let approved = ctx
        .license_svc
        .accept(&license.id, owner.id.clone())
        .await
        .unwrap();
    assert_eq!(approved.status, LicenseStatus::Approved);
    assert_eq!(approved.resolved_by, Some(owner.id));
}

#[tokio::test]
async fn test_service_accept_own_offer_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    // Movie team made the latest offer — it cannot approve its own offer.
    let err = ctx
        .license_svc
        .accept(&license.id, owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.own_offer");
}

#[tokio::test]
async fn test_service_accept_own_counter_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(9000.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .accept(&license.id, artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.own_offer");
}

#[tokio::test]
async fn test_service_accept_in_draft_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .accept(&license.id, artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_accept_outsider_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let outsider = ctx.create_user().await;
    let err = ctx
        .license_svc
        .accept(&license.id, outsider.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

// ============================================================================
// Service: Reject
// ============================================================================

#[tokio::test]
async fn test_service_reject_by_artist() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let rejected = ctx
        .license_svc
        .reject(&license.id, artist.id.clone(), "Too low".into())
        .await
        .unwrap();
    assert_eq!(rejected.status, LicenseStatus::Rejected);
    assert_eq!(rejected.resolved_by, Some(artist.id));
    assert_eq!(rejected.rejection_reason.as_deref(), Some("Too low"));
}

#[tokio::test]
async fn test_service_reject_own_offer_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let err = ctx
        .license_svc
        .reject(&license.id, owner.id.clone(), "nope".into())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.own_offer");
}

#[tokio::test]
async fn test_service_reject_by_movie_after_counter() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(99999.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    let rejected = ctx
        .license_svc
        .reject(&license.id, owner.id.clone(), "Too expensive".into())
        .await
        .unwrap();
    assert_eq!(rejected.status, LicenseStatus::Rejected);
    assert_eq!(rejected.resolved_by, Some(owner.id));
}

#[tokio::test]
async fn test_service_reject_after_approved_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .accept(&license.id, artist.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .reject(&license.id, artist.id.clone(), "nah".into())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

// ============================================================================
// Service: Cancel (movie team)
// ============================================================================

#[tokio::test]
async fn test_service_cancel() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let cancelled = ctx
        .license_svc
        .cancel(&license.id, owner.id.clone())
        .await
        .unwrap();
    assert_eq!(cancelled.status, LicenseStatus::Cancelled);
    assert_eq!(cancelled.resolved_by, Some(owner.id));
}

#[tokio::test]
async fn test_service_cancel_by_rights_holder_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let err = ctx
        .license_svc
        .cancel(&license.id, artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

#[tokio::test]
async fn test_service_cancel_from_draft_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .cancel(&license.id, owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_cancel_from_approved_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .accept(&license.id, artist.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .cancel(&license.id, owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

// ============================================================================
// Service: Label rights holder rules
// ============================================================================

#[tokio::test]
async fn test_service_label_rep_can_counter_and_accept() {
    let ctx = TestContext::new().await;
    let (track, owner, label_rep, _) = ctx.setup_track_with_label().await;
    let license = ctx.requested(&track, &owner).await;
    let offer = ctx
        .license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(12000.0)),
            label_rep.id.clone(),
        )
        .await
        .unwrap();
    assert_eq!(offer.side, NegotiationSide::RightsHolder);

    // Movie team accepts the label's counter.
    let approved = ctx
        .license_svc
        .accept(&license.id, owner.id.clone())
        .await
        .unwrap();
    assert_eq!(approved.status, LicenseStatus::Approved);
}

#[tokio::test]
async fn test_service_artist_blocked_when_label_exists() {
    let ctx = TestContext::new().await;
    let (track, owner, _label_rep, _) = ctx.setup_track_with_label().await;
    let song = ctx
        .song_repo
        .get_by_id(&track.song_id)
        .await
        .unwrap()
        .unwrap();
    let license = ctx.requested(&track, &owner).await;
    // The song's artist is blocked because the label holds the rights.
    let err = ctx
        .license_svc
        .accept(&license.id, song.artist_id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

// ============================================================================
// Service: Offer history
// ============================================================================

#[tokio::test]
async fn test_service_list_offers() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(8000.0)),
            artist.id.clone(),
        )
        .await
        .unwrap();
    ctx.license_svc
        .counter_offer(
            &license.id,
            TestContext::terms(Some(7000.0)),
            owner.id.clone(),
        )
        .await
        .unwrap();

    let offers = ctx.license_svc.list_offers(&license.id).await.unwrap();
    assert_eq!(offers.len(), 3);
    assert_eq!(offers[0].offer_number, 1);
    assert_eq!(offers[0].side, NegotiationSide::MovieTeam);
    assert_eq!(offers[1].side, NegotiationSide::RightsHolder);
    assert_eq!(offers[2].side, NegotiationSide::MovieTeam);
}

// ============================================================================
// Service: Delete
// ============================================================================

#[tokio::test]
async fn test_service_delete_draft() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    ctx.license_svc
        .delete_license(&license.id, owner.id.clone())
        .await
        .unwrap();
    let err = ctx.license_svc.get_license(&license.id).await.unwrap_err();
    assert_eq!(err.code, "license.not_found");
}

#[tokio::test]
async fn test_service_delete_requested_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let license = ctx.requested(&track, &owner).await;
    let err = ctx
        .license_svc
        .delete_license(&license.id, owner.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.invalid_transition");
}

#[tokio::test]
async fn test_service_delete_draft_by_artist_fails() {
    let ctx = TestContext::new().await;
    let (track, owner, artist, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();
    let err = ctx
        .license_svc
        .delete_license(&license.id, artist.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "license.not_authorized");
}

// ============================================================================
// Cascade
// ============================================================================

#[tokio::test]
async fn test_delete_track_cascades_licenses() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    ctx.license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();

    ctx.track_repo.delete(&track.id).await.unwrap();
    let list = ctx.license_repo.list_by_track(&track.id).await.unwrap();
    assert_eq!(list.len(), 0);
}

#[tokio::test]
async fn test_delete_license_cascades_offers() {
    let ctx = TestContext::new().await;
    let (track, owner, _, _) = ctx.setup_track().await;
    let (license, _) = ctx
        .license_svc
        .create_license(ctx.create_license_req(track.id.clone()), owner.id.clone())
        .await
        .unwrap();

    // Verify offer exists
    let offers = ctx.license_repo.list_offers(&license.id).await.unwrap();
    assert_eq!(offers.len(), 1);

    // Delete and verify offers cascaded
    ctx.license_repo.delete(&license.id).await.unwrap();
    let offers = ctx.license_repo.list_offers(&license.id).await.unwrap();
    assert_eq!(offers.len(), 0);
}
