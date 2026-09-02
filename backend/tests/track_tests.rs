mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::{SceneId, SongId, TrackId, UserId};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::adapters::PostgresSceneRepository;
use backend::scene::{Scene, SceneRepository};
use backend::song::adapters::PostgresSongRepository;
use backend::song::{Song, SongRepository};
use backend::track::adapters::PostgresTrackRepository;
use backend::track::{
    CreateTrackRequest, Track, TrackRepository, TrackService, UpdateTrackRequest,
};

use common::TestDb;

struct TestContext {
    track_svc: TrackService,
    track_repo: Arc<PostgresTrackRepository>,
    scene_repo: Arc<PostgresSceneRepository>,
    song_repo: Arc<PostgresSongRepository>,
    movie_repo: Arc<PostgresMovieRepository>,
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
        let password_svc = Arc::new(BcryptPasswordService::new());
        let track_svc = TrackService::new(
            track_repo.clone(),
            scene_repo.clone(),
            song_repo.clone(),
            movie_repo.clone(),
            user_repo.clone(),
        );

        Self {
            track_svc,
            track_repo,
            scene_repo,
            song_repo,
            movie_repo,
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

    async fn create_movie(&self) -> (Movie, User) {
        let user = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), user.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        self.movie_repo
            .add_member(&MovieMember {
                movie_id: movie.id.clone(),
                user_id: user.id.clone(),
                role: MovieRole::Owner,
                joined_at: movie.created_at,
            })
            .await
            .unwrap();
        (movie, user)
    }

    async fn create_scene(&self) -> (Scene, User) {
        let (movie, user) = self.create_movie().await;
        let scene = Scene::new(movie.id.clone(), "Opening".into(), 1, 0, 120);
        self.scene_repo.save(&scene).await.unwrap();
        (scene, user)
    }

    async fn create_song(&self) -> Song {
        let user = self.create_user().await;
        let song = Song::new("Test Song".into(), user.id.clone(), None, 240);
        self.song_repo.save(&song).await.unwrap();
        song
    }

    async fn create_scene_and_song(&self) -> (Scene, Song, User) {
        let user = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), user.id.clone());
        self.movie_repo.save(&movie).await.unwrap();
        self.movie_repo
            .add_member(&MovieMember {
                movie_id: movie.id.clone(),
                user_id: user.id.clone(),
                role: MovieRole::Owner,
                joined_at: movie.created_at,
            })
            .await
            .unwrap();
        let scene = Scene::new(movie.id.clone(), "Opening".into(), 1, 0, 120);
        self.scene_repo.save(&scene).await.unwrap();
        let song = Song::new("Test Song".into(), user.id.clone(), None, 240);
        self.song_repo.save(&song).await.unwrap();
        (scene, song, user)
    }

    fn create_req(&self, scene_id: SceneId, song_id: SongId) -> CreateTrackRequest {
        CreateTrackRequest {
            scene_id,
            song_id,
            usage_type: "BACKGROUND".into(),
            start_time_seconds: 0,
            end_time_seconds: 60,
            notes: None,
        }
    }
}

// ============================================================================
// Repository: CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;

    let track = Track::new(
        scene.id.clone(),
        song.id.clone(),
        backend::track::UsageType::Background,
        0,
        60,
        user.id.clone(),
    );
    ctx.track_repo.save(&track).await.unwrap();

    let found = ctx.track_repo.get_by_id(&track.id).await.unwrap().unwrap();
    assert_eq!(found.scene_id, scene.id);
    assert_eq!(found.song_id, song.id);
    assert_eq!(found.usage_type, backend::track::UsageType::Background);
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx.track_repo.get_by_id(&TrackId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;

    let mut track = Track::new(
        scene.id.clone(),
        song.id.clone(),
        backend::track::UsageType::Background,
        0,
        60,
        user.id.clone(),
    );
    ctx.track_repo.save(&track).await.unwrap();

    track.usage_type = backend::track::UsageType::Featured;
    track.notes = Some("Updated".into());
    ctx.track_repo.update(&track).await.unwrap();

    let found = ctx.track_repo.get_by_id(&track.id).await.unwrap().unwrap();
    assert_eq!(found.usage_type, backend::track::UsageType::Featured);
    assert_eq!(found.notes.as_deref(), Some("Updated"));
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;

    let track = Track::new(
        scene.id.clone(),
        song.id.clone(),
        backend::track::UsageType::Credits,
        0,
        60,
        user.id.clone(),
    );
    ctx.track_repo.save(&track).await.unwrap();
    ctx.track_repo.delete(&track.id).await.unwrap();
    assert!(ctx.track_repo.get_by_id(&track.id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_repo_list_by_scene() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user().await;
    let movie = Movie::new("Movie".into(), user.id.clone());
    ctx.movie_repo.save(&movie).await.unwrap();
    let scene = Scene::new(movie.id.clone(), "S1".into(), 1, 0, 60);
    ctx.scene_repo.save(&scene).await.unwrap();

    let song1 = Song::new("Song1".into(), user.id.clone(), None, 200);
    ctx.song_repo.save(&song1).await.unwrap();
    let song2 = Song::new("Song2".into(), user.id.clone(), None, 180);
    ctx.song_repo.save(&song2).await.unwrap();

    ctx.track_repo
        .save(&Track::new(
            scene.id.clone(),
            song1.id.clone(),
            backend::track::UsageType::Background,
            0,
            60,
            user.id.clone(),
        ))
        .await
        .unwrap();
    ctx.track_repo
        .save(&Track::new(
            scene.id.clone(),
            song2.id.clone(),
            backend::track::UsageType::Featured,
            0,
            60,
            user.id.clone(),
        ))
        .await
        .unwrap();

    let tracks = ctx.track_repo.list_by_scene(&scene.id).await.unwrap();
    assert_eq!(tracks.len(), 2);
}

#[tokio::test]
async fn test_repo_list_by_song() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user().await;
    let movie = Movie::new("Movie".into(), user.id.clone());
    ctx.movie_repo.save(&movie).await.unwrap();
    let scene1 = Scene::new(movie.id.clone(), "S1".into(), 1, 0, 60);
    ctx.scene_repo.save(&scene1).await.unwrap();
    let scene2 = Scene::new(movie.id.clone(), "S2".into(), 2, 60, 120);
    ctx.scene_repo.save(&scene2).await.unwrap();

    let song = Song::new("Song".into(), user.id.clone(), None, 200);
    ctx.song_repo.save(&song).await.unwrap();

    ctx.track_repo
        .save(&Track::new(
            scene1.id.clone(),
            song.id.clone(),
            backend::track::UsageType::Background,
            0,
            60,
            user.id.clone(),
        ))
        .await
        .unwrap();
    ctx.track_repo
        .save(&Track::new(
            scene2.id.clone(),
            song.id.clone(),
            backend::track::UsageType::Credits,
            0,
            60,
            user.id.clone(),
        ))
        .await
        .unwrap();

    let tracks = ctx.track_repo.list_by_song(&song.id).await.unwrap();
    assert_eq!(tracks.len(), 2);
}

#[tokio::test]
async fn test_repo_get_by_scene_and_song() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;

    let track = Track::new(
        scene.id.clone(),
        song.id.clone(),
        backend::track::UsageType::Trailer,
        0,
        60,
        user.id.clone(),
    );
    ctx.track_repo.save(&track).await.unwrap();

    let found = ctx
        .track_repo
        .get_by_scene_and_song(&scene.id, &song.id)
        .await
        .unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, track.id);
}

#[tokio::test]
async fn test_repo_get_by_scene_and_song_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx
        .track_repo
        .get_by_scene_and_song(&SceneId::new(), &SongId::new())
        .await
        .unwrap();
    assert!(result.is_none());
}

// ============================================================================
// Service: Create
// ============================================================================

#[tokio::test]
async fn test_service_create_track() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;

    let track = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();

    assert_eq!(track.scene_id, scene.id);
    assert_eq!(track.song_id, song.id);
    assert_eq!(track.created_by, user.id);
}

#[tokio::test]
async fn test_service_create_track_with_notes() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    let mut req = ctx.create_req(scene.id.clone(), song.id.clone());
    req.notes = Some("Soft background music".into());
    let track = ctx
        .track_svc
        .create_track(req, user.id.clone())
        .await
        .unwrap();
    assert_eq!(track.notes.as_deref(), Some("Soft background music"));
}

#[tokio::test]
async fn test_service_create_track_scene_not_found() {
    let ctx = TestContext::new().await;
    let song = ctx.create_song().await;
    let err = ctx
        .track_svc
        .create_track(
            ctx.create_req(SceneId::new(), song.id.clone()),
            UserId::new(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_track_song_not_found() {
    let ctx = TestContext::new().await;
    let (scene, user) = ctx.create_scene().await;
    let err = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), SongId::new()),
            user.id.clone(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_track_duplicate() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    ctx.track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();
    let err = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "track.already_exists");
}

#[tokio::test]
async fn test_service_create_track_invalid_usage() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    let mut req = ctx.create_req(scene.id.clone(), song.id.clone());
    req.usage_type = "NOPE".into();
    let err = ctx
        .track_svc
        .create_track(req, user.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

// ============================================================================
// Service: Get / List
// ============================================================================

#[tokio::test]
async fn test_service_get_track() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    let created = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();
    let found = ctx.track_svc.get_track(&created.id).await.unwrap();
    assert_eq!(found.id, created.id);
}

#[tokio::test]
async fn test_service_get_track_not_found() {
    let ctx = TestContext::new().await;
    let err = ctx.track_svc.get_track(&TrackId::new()).await.unwrap_err();
    assert_eq!(err.code, "track.not_found");
}

#[tokio::test]
async fn test_service_list_by_scene() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user().await;
    let movie = Movie::new("Movie".into(), user.id.clone());
    ctx.movie_repo.save(&movie).await.unwrap();
    ctx.movie_repo
        .add_member(&MovieMember {
            movie_id: movie.id.clone(),
            user_id: user.id.clone(),
            role: MovieRole::Owner,
            joined_at: movie.created_at,
        })
        .await
        .unwrap();
    let scene = Scene::new(movie.id.clone(), "S1".into(), 1, 0, 60);
    ctx.scene_repo.save(&scene).await.unwrap();

    let song1 = Song::new("Song1".into(), user.id.clone(), None, 200);
    ctx.song_repo.save(&song1).await.unwrap();
    let song2 = Song::new("Song2".into(), user.id.clone(), None, 180);
    ctx.song_repo.save(&song2).await.unwrap();

    ctx.track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song1.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();
    let mut req2 = ctx.create_req(scene.id.clone(), song2.id.clone());
    req2.usage_type = "FEATURED".into();
    ctx.track_svc
        .create_track(req2, user.id.clone())
        .await
        .unwrap();

    let tracks = ctx.track_svc.list_by_scene(&scene.id).await.unwrap();
    assert_eq!(tracks.len(), 2);
}

// ============================================================================
// Service: Update
// ============================================================================

#[tokio::test]
async fn test_service_update_track() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    let created = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();

    let updated = ctx
        .track_svc
        .update_track(
            &created.id,
            UpdateTrackRequest {
                usage_type: Some("CREDITS".into()),
                start_time_seconds: None,
                end_time_seconds: None,
                notes: Some("End credits music".into()),
            },
            &user.id,
        )
        .await
        .unwrap();
    assert_eq!(updated.usage_type, backend::track::UsageType::Credits);
    assert_eq!(updated.notes.as_deref(), Some("End credits music"));
}

#[tokio::test]
async fn test_service_update_track_not_found() {
    let ctx = TestContext::new().await;
    let actor = UserId::new();
    let err = ctx
        .track_svc
        .update_track(
            &TrackId::new(),
            UpdateTrackRequest {
                usage_type: Some("FEATURED".into()),
                start_time_seconds: None,
                end_time_seconds: None,
                notes: None,
            },
            &actor,
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "track.not_found");
}

// ============================================================================
// Service: Delete
// ============================================================================

#[tokio::test]
async fn test_service_delete_track() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    let created = ctx
        .track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();
    ctx.track_svc
        .delete_track(&created.id, &user.id)
        .await
        .unwrap();
    let err = ctx.track_svc.get_track(&created.id).await.unwrap_err();
    assert_eq!(err.code, "track.not_found");
}

#[tokio::test]
async fn test_service_delete_track_not_found() {
    let ctx = TestContext::new().await;
    let actor = UserId::new();
    let err = ctx
        .track_svc
        .delete_track(&TrackId::new(), &actor)
        .await
        .unwrap_err();
    assert_eq!(err.code, "track.not_found");
}

// ============================================================================
// Cascade: deleting scene cascades tracks
// ============================================================================

#[tokio::test]
async fn test_delete_scene_cascades_tracks() {
    let ctx = TestContext::new().await;
    let (scene, song, user) = ctx.create_scene_and_song().await;
    ctx.track_svc
        .create_track(
            ctx.create_req(scene.id.clone(), song.id.clone()),
            user.id.clone(),
        )
        .await
        .unwrap();

    ctx.scene_repo.delete(&scene.id).await.unwrap();
    let tracks = ctx.track_repo.list_by_scene(&scene.id).await.unwrap();
    assert_eq!(tracks.len(), 0);
}
