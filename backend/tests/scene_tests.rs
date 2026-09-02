mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::{MovieId, SceneId, UserId};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{Movie, MovieMember, MovieRepository, MovieRole};
use backend::scene::adapters::PostgresSceneRepository;
use backend::scene::{
    CreateSceneRequest, Scene, SceneRepository, SceneService, UpdateSceneRequest,
};

use common::TestDb;

struct TestContext {
    scene_svc: SceneService,
    scene_repo: Arc<PostgresSceneRepository>,
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
        let password_svc = Arc::new(BcryptPasswordService::new());
        let scene_svc = SceneService::new(scene_repo.clone(), movie_repo.clone());

        Self {
            scene_svc,
            scene_repo,
            movie_repo,
            user_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_user(&self) -> User {
        let hash = self.password_svc.hash_password("password123").unwrap();
        let mut user = User::new_with_password("user@example.com".into(), "Test".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    async fn create_movie(&self) -> (Movie, User) {
        let user = self.create_user().await;
        let movie = Movie::new("Test Movie".into(), user.id.clone());
        let owner = MovieMember {
            movie_id: movie.id.clone(),
            user_id: user.id.clone(),
            role: MovieRole::Owner,
            joined_at: movie.created_at,
        };
        self.movie_repo.save(&movie).await.unwrap();
        self.movie_repo.add_member(&owner).await.unwrap();
        (movie, user)
    }

    fn create_req(&self, movie_id: MovieId) -> CreateSceneRequest {
        CreateSceneRequest {
            movie_id,
            title: "Opening".into(),
            scene_number: 1,
            description: Some("Opening credits".into()),
            start_time: 0,
            end_time: 120,
        }
    }
}

// ============================================================================
// Repository: CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let (movie, _user) = ctx.create_movie().await;

    let mut scene = Scene::new(movie.id.clone(), "Chase".into(), 1, 0, 300);
    scene.description = Some("Car chase".into());
    ctx.scene_repo.save(&scene).await.unwrap();

    let found = ctx.scene_repo.get_by_id(&scene.id).await.unwrap().unwrap();
    assert_eq!(found.title, "Chase");
    assert_eq!(found.scene_number, 1);
    assert_eq!(found.start_time, 0);
    assert_eq!(found.end_time, 300);
    assert_eq!(found.description.as_deref(), Some("Car chase"));
    assert_eq!(found.movie_id.as_str(), movie.id.as_str());
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx.scene_repo.get_by_id(&SceneId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let (movie, _user) = ctx.create_movie().await;

    let mut scene = Scene::new(movie.id.clone(), "Old".into(), 1, 0, 60);
    ctx.scene_repo.save(&scene).await.unwrap();

    scene.title = "New".into();
    scene.scene_number = 2;
    scene.start_time = 60;
    scene.end_time = 180;
    ctx.scene_repo.update(&scene).await.unwrap();

    let found = ctx.scene_repo.get_by_id(&scene.id).await.unwrap().unwrap();
    assert_eq!(found.title, "New");
    assert_eq!(found.scene_number, 2);
    assert_eq!(found.start_time, 60);
    assert_eq!(found.end_time, 180);
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let (movie, _user) = ctx.create_movie().await;

    let scene = Scene::new(movie.id.clone(), "Delete Me".into(), 1, 0, 60);
    ctx.scene_repo.save(&scene).await.unwrap();

    ctx.scene_repo.delete(&scene.id).await.unwrap();
    assert!(ctx.scene_repo.get_by_id(&scene.id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_repo_list_by_movie() {
    let ctx = TestContext::new().await;
    let (movie, _user) = ctx.create_movie().await;

    ctx.scene_repo
        .save(&Scene::new(movie.id.clone(), "S1".into(), 1, 0, 60))
        .await
        .unwrap();
    ctx.scene_repo
        .save(&Scene::new(movie.id.clone(), "S2".into(), 2, 60, 120))
        .await
        .unwrap();

    let scenes = ctx.scene_repo.list_by_movie(&movie.id).await.unwrap();
    assert_eq!(scenes.len(), 2);
    // Should be ordered by scene_number
    assert_eq!(scenes[0].scene_number, 1);
    assert_eq!(scenes[1].scene_number, 2);
}

#[tokio::test]
async fn test_repo_list_by_movie_ordered() {
    let ctx = TestContext::new().await;
    let (movie, _user) = ctx.create_movie().await;

    // Insert in reverse order
    ctx.scene_repo
        .save(&Scene::new(movie.id.clone(), "S3".into(), 3, 200, 300))
        .await
        .unwrap();
    ctx.scene_repo
        .save(&Scene::new(movie.id.clone(), "S1".into(), 1, 0, 100))
        .await
        .unwrap();
    ctx.scene_repo
        .save(&Scene::new(movie.id.clone(), "S2".into(), 2, 100, 200))
        .await
        .unwrap();

    let scenes = ctx.scene_repo.list_by_movie(&movie.id).await.unwrap();
    assert_eq!(scenes[0].title, "S1");
    assert_eq!(scenes[1].title, "S2");
    assert_eq!(scenes[2].title, "S3");
}

// ============================================================================
// Service: Create
// ============================================================================

#[tokio::test]
async fn test_service_create_scene() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;

    let scene = ctx
        .scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();

    assert_eq!(scene.title, "Opening");
    assert_eq!(scene.scene_number, 1);
    assert_eq!(scene.start_time, 0);
    assert_eq!(scene.end_time, 120);
    assert_eq!(scene.description.as_deref(), Some("Opening credits"));
}

#[tokio::test]
async fn test_service_create_scene_movie_not_found() {
    let ctx = TestContext::new().await;
    let actor = UserId::new();
    let err = ctx
        .scene_svc
        .create_scene(ctx.create_req(MovieId::new()), &actor)
        .await
        .unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_scene_empty_title() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let mut req = ctx.create_req(movie.id.clone());
    req.title = "  ".into();
    let err = ctx.scene_svc.create_scene(req, &user.id).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_create_scene_end_before_start() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let mut req = ctx.create_req(movie.id.clone());
    req.start_time = 200;
    req.end_time = 100;
    let err = ctx.scene_svc.create_scene(req, &user.id).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

// ============================================================================
// Service: Get / List
// ============================================================================

#[tokio::test]
async fn test_service_get_scene() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let created = ctx
        .scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();
    let found = ctx.scene_svc.get_scene(&created.id).await.unwrap();
    assert_eq!(found.title, "Opening");
}

#[tokio::test]
async fn test_service_get_scene_not_found() {
    let ctx = TestContext::new().await;
    let err = ctx.scene_svc.get_scene(&SceneId::new()).await.unwrap_err();
    assert_eq!(err.code, "scene.not_found");
}

#[tokio::test]
async fn test_service_list_by_movie() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;

    ctx.scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();

    let mut req2 = ctx.create_req(movie.id.clone());
    req2.title = "Chase".into();
    req2.scene_number = 2;
    req2.start_time = 120;
    req2.end_time = 300;
    ctx.scene_svc.create_scene(req2, &user.id).await.unwrap();

    let scenes = ctx.scene_svc.list_by_movie(&movie.id).await.unwrap();
    assert_eq!(scenes.len(), 2);
}

// ============================================================================
// Service: Update
// ============================================================================

#[tokio::test]
async fn test_service_update_scene() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let scene = ctx
        .scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();

    let updated = ctx
        .scene_svc
        .update_scene(
            &scene.id,
            UpdateSceneRequest {
                title: Some("Finale".into()),
                scene_number: Some(5),
                description: Some("Final battle".into()),
                start_time: Some(3600),
                end_time: Some(4200),
            },
            &user.id,
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Finale");
    assert_eq!(updated.scene_number, 5);
    assert_eq!(updated.start_time, 3600);
    assert_eq!(updated.end_time, 4200);
}

#[tokio::test]
async fn test_service_update_scene_partial() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let scene = ctx
        .scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();

    let updated = ctx
        .scene_svc
        .update_scene(
            &scene.id,
            UpdateSceneRequest {
                title: Some("Changed".into()),
                scene_number: None,
                description: None,
                start_time: None,
                end_time: None,
            },
            &user.id,
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Changed");
    assert_eq!(updated.start_time, 0);
    assert_eq!(updated.end_time, 120);
}

#[tokio::test]
async fn test_service_update_scene_not_found() {
    let ctx = TestContext::new().await;
    let actor = UserId::new();
    let err = ctx
        .scene_svc
        .update_scene(
            &SceneId::new(),
            UpdateSceneRequest {
                title: Some("X".into()),
                scene_number: None,
                description: None,
                start_time: None,
                end_time: None,
            },
            &actor,
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "scene.not_found");
}

// ============================================================================
// Service: Delete
// ============================================================================

#[tokio::test]
async fn test_service_delete_scene() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;
    let scene = ctx
        .scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();
    ctx.scene_svc
        .delete_scene(&scene.id, &user.id)
        .await
        .unwrap();
    let err = ctx.scene_svc.get_scene(&scene.id).await.unwrap_err();
    assert_eq!(err.code, "scene.not_found");
}

#[tokio::test]
async fn test_service_delete_scene_not_found() {
    let ctx = TestContext::new().await;
    let actor = UserId::new();
    let err = ctx
        .scene_svc
        .delete_scene(&SceneId::new(), &actor)
        .await
        .unwrap_err();
    assert_eq!(err.code, "scene.not_found");
}

// ============================================================================
// Cascade: deleting movie cascades scenes
// ============================================================================

#[tokio::test]
async fn test_delete_movie_cascades_scenes() {
    let ctx = TestContext::new().await;
    let (movie, user) = ctx.create_movie().await;

    ctx.scene_svc
        .create_scene(ctx.create_req(movie.id.clone()), &user.id)
        .await
        .unwrap();

    ctx.movie_repo.delete(&movie.id).await.unwrap();

    let scenes = ctx.scene_repo.list_by_movie(&movie.id).await.unwrap();
    assert_eq!(scenes.len(), 0);
}
