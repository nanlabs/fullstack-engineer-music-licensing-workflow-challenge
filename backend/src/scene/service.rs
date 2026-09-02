use std::sync::Arc;

use chrono::Utc;

use crate::error::AppError;
use crate::kernel::{SceneId, UserId};
use crate::movie::{MovieRepository, MovieRole};

use super::error::SceneError;
use super::model::{CreateSceneRequest, Scene, UpdateSceneRequest};
use super::port::SceneRepository;

pub struct SceneService {
    scene_repo: Arc<dyn SceneRepository>,
    movie_repo: Arc<dyn MovieRepository>,
}

impl SceneService {
    pub fn new(scene_repo: Arc<dyn SceneRepository>, movie_repo: Arc<dyn MovieRepository>) -> Self {
        Self {
            scene_repo,
            movie_repo,
        }
    }

    // ========================================================================
    // Authorization helpers
    // ========================================================================

    /// Assert the actor is a movie team member with a write role
    /// (Owner, Supervisor, or Editor — not Viewer).
    async fn assert_movie_team(
        &self,
        movie_id: &crate::kernel::MovieId,
        actor: &UserId,
    ) -> Result<(), AppError> {
        let member = self.movie_repo.get_member(movie_id, actor).await?;
        match member {
            Some(m) if m.role != MovieRole::Viewer => Ok(()),
            _ => Err(SceneError::not_authorized()),
        }
    }

    // ========================================================================
    // CRUD
    // ========================================================================

    pub async fn create_scene(
        &self,
        req: CreateSceneRequest,
        actor: &UserId,
    ) -> Result<Scene, AppError> {
        req.validate()?;

        self.movie_repo
            .get_by_id(&req.movie_id)
            .await?
            .ok_or_else(|| AppError::not_found("Movie not found"))?;

        self.assert_movie_team(&req.movie_id, actor).await?;

        let mut scene = Scene::new(
            req.movie_id,
            req.title,
            req.scene_number,
            req.start_time,
            req.end_time,
        );
        scene.description = req.description;

        self.scene_repo.save(&scene).await?;
        Ok(scene)
    }

    pub async fn get_scene(&self, id: &SceneId) -> Result<Scene, AppError> {
        self.scene_repo
            .get_by_id(id)
            .await?
            .ok_or_else(SceneError::not_found)
    }

    pub async fn list_by_movie(
        &self,
        movie_id: &crate::kernel::MovieId,
    ) -> Result<Vec<Scene>, AppError> {
        self.scene_repo.list_by_movie(movie_id).await
    }

    pub async fn update_scene(
        &self,
        id: &SceneId,
        req: UpdateSceneRequest,
        actor: &UserId,
    ) -> Result<Scene, AppError> {
        req.validate()?;

        let scene = self.get_scene(id).await?;
        self.assert_movie_team(&scene.movie_id, actor).await?;

        let mut scene = scene;

        if let Some(title) = req.title {
            scene.title = title;
        }
        if let Some(scene_number) = req.scene_number {
            scene.scene_number = scene_number;
        }
        if let Some(description) = req.description {
            scene.description = Some(description);
        }

        // Handle time updates — validate consistency
        let new_start = req.start_time.unwrap_or(scene.start_time);
        let new_end = req.end_time.unwrap_or(scene.end_time);
        if new_end <= new_start {
            return Err(AppError::validation(
                "End time must be greater than start time",
            ));
        }
        scene.start_time = new_start;
        scene.end_time = new_end;

        scene.updated_at = Utc::now();

        self.scene_repo.update(&scene).await?;
        Ok(scene)
    }

    pub async fn delete_scene(&self, id: &SceneId, actor: &UserId) -> Result<(), AppError> {
        let scene = self.get_scene(id).await?;
        self.assert_movie_team(&scene.movie_id, actor).await?;
        self.scene_repo.delete(id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kernel::{MovieId, Paginated, PaginationOptions, UserId};
    use crate::movie::{Movie, MovieMember, MovieRepository, MovieRole};
    use chrono::Utc as ChronoUtc;
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockSceneRepo {
        scenes: Mutex<Vec<Scene>>,
    }
    impl MockSceneRepo {
        fn new() -> Self {
            Self {
                scenes: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl SceneRepository for MockSceneRepo {
        async fn save(&self, scene: &Scene) -> Result<(), AppError> {
            self.scenes.lock().await.push(scene.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &SceneId) -> Result<Option<Scene>, AppError> {
            Ok(self
                .scenes
                .lock()
                .await
                .iter()
                .find(|s| s.id == *id)
                .cloned())
        }
        async fn list_by_movie(&self, movie_id: &MovieId) -> Result<Vec<Scene>, AppError> {
            Ok(self
                .scenes
                .lock()
                .await
                .iter()
                .filter(|s| s.movie_id == *movie_id)
                .cloned()
                .collect())
        }
        async fn update(&self, scene: &Scene) -> Result<(), AppError> {
            let mut scenes = self.scenes.lock().await;
            if let Some(s) = scenes.iter_mut().find(|s| s.id == scene.id) {
                *s = scene.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &SceneId) -> Result<(), AppError> {
            self.scenes.lock().await.retain(|s| s.id != *id);
            Ok(())
        }
    }

    struct MockMovieRepo {
        movies: Mutex<Vec<Movie>>,
        members: Mutex<Vec<MovieMember>>,
    }
    impl MockMovieRepo {
        fn new() -> Self {
            Self {
                movies: Mutex::new(Vec::new()),
                members: Mutex::new(Vec::new()),
            }
        }
        fn with_movie_and_owner(movie: Movie, owner_id: UserId) -> Self {
            let member = MovieMember {
                movie_id: movie.id.clone(),
                user_id: owner_id,
                role: MovieRole::Owner,
                joined_at: ChronoUtc::now(),
            };
            Self {
                movies: Mutex::new(vec![movie]),
                members: Mutex::new(vec![member]),
            }
        }
    }
    #[async_trait::async_trait]
    impl MovieRepository for MockMovieRepo {
        async fn save(&self, _: &Movie) -> Result<(), AppError> {
            Ok(())
        }
        async fn save_with_owner(&self, _: &Movie, _: &MovieMember) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &MovieId) -> Result<Option<Movie>, AppError> {
            let movies = self.movies.lock().await;
            Ok(movies.iter().find(|m| m.id == *id).cloned())
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &crate::movie::MovieFilter,
        ) -> Result<Paginated<Movie>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn update(&self, _: &Movie) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &MovieId) -> Result<(), AppError> {
            Ok(())
        }
        async fn list_by_user(&self, _: &UserId) -> Result<Vec<Movie>, AppError> {
            Ok(vec![])
        }
        async fn add_member(&self, _: &MovieMember) -> Result<(), AppError> {
            Ok(())
        }
        async fn remove_member(&self, _: &MovieId, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_member(
            &self,
            movie_id: &MovieId,
            user_id: &UserId,
        ) -> Result<Option<MovieMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .find(|m| m.movie_id == *movie_id && m.user_id == *user_id)
                .cloned())
        }
        async fn list_members(&self, _: &MovieId) -> Result<Vec<MovieMember>, AppError> {
            Ok(vec![])
        }
        async fn get_user_movies(&self, _: &UserId) -> Result<Vec<Movie>, AppError> {
            Ok(vec![])
        }
    }

    fn make_movie() -> (Movie, UserId) {
        let owner_id = UserId::new();
        let movie = Movie::new("Test Movie".into(), owner_id.clone());
        (movie, owner_id)
    }

    fn make_svc(scene_repo: MockSceneRepo, movie_repo: MockMovieRepo) -> SceneService {
        SceneService::new(Arc::new(scene_repo), Arc::new(movie_repo))
    }

    fn create_req(movie_id: MovieId) -> CreateSceneRequest {
        CreateSceneRequest {
            movie_id,
            title: "Opening".into(),
            scene_number: 1,
            description: Some("Opening scene".into()),
            start_time: 0,
            end_time: 120,
        }
    }

    // ========================================================================
    // create_scene
    // ========================================================================

    #[tokio::test]
    async fn create_scene_success() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        assert_eq!(scene.title, "Opening");
        assert_eq!(scene.scene_number, 1);
        assert_eq!(scene.start_time, 0);
        assert_eq!(scene.end_time, 120);
        assert_eq!(scene.description.as_deref(), Some("Opening scene"));
    }

    #[tokio::test]
    async fn create_scene_movie_not_found() {
        let svc = make_svc(MockSceneRepo::new(), MockMovieRepo::new());
        let actor = UserId::new();
        let err = svc
            .create_scene(create_req(MovieId::new()), &actor)
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_scene_empty_title() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let mut req = create_req(movie.id.clone());
        req.title = "  ".into();
        let err = svc.create_scene(req, &owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_scene_invalid_scene_number() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let mut req = create_req(movie.id.clone());
        req.scene_number = 0;
        let err = svc.create_scene(req, &owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_scene_negative_start() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let mut req = create_req(movie.id.clone());
        req.start_time = -1;
        let err = svc.create_scene(req, &owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_scene_end_before_start() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let mut req = create_req(movie.id.clone());
        req.start_time = 100;
        req.end_time = 50;
        let err = svc.create_scene(req, &owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_scene_end_equals_start() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let mut req = create_req(movie.id.clone());
        req.start_time = 100;
        req.end_time = 100;
        let err = svc.create_scene(req, &owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_scene / list_by_movie
    // ========================================================================

    #[tokio::test]
    async fn get_scene_success() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let created = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        let found = svc.get_scene(&created.id).await.unwrap();
        assert_eq!(found.title, "Opening");
    }

    #[tokio::test]
    async fn get_scene_not_found() {
        let svc = make_svc(MockSceneRepo::new(), MockMovieRepo::new());
        let err = svc.get_scene(&SceneId::new()).await.unwrap_err();
        assert_eq!(err.code, "scene.not_found");
    }

    #[tokio::test]
    async fn list_by_movie_success() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );

        let mut req1 = create_req(movie.id.clone());
        req1.title = "Scene 1".into();
        req1.scene_number = 1;
        svc.create_scene(req1, &owner_id).await.unwrap();

        let mut req2 = create_req(movie.id.clone());
        req2.title = "Scene 2".into();
        req2.scene_number = 2;
        req2.start_time = 120;
        req2.end_time = 300;
        svc.create_scene(req2, &owner_id).await.unwrap();

        let scenes = svc.list_by_movie(&movie.id).await.unwrap();
        assert_eq!(scenes.len(), 2);
    }

    // ========================================================================
    // update_scene
    // ========================================================================

    #[tokio::test]
    async fn update_scene_success() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        let updated = svc
            .update_scene(
                &scene.id,
                UpdateSceneRequest {
                    title: Some("Chase".into()),
                    scene_number: Some(2),
                    description: Some("Car chase".into()),
                    start_time: Some(60),
                    end_time: Some(180),
                },
                &owner_id,
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "Chase");
        assert_eq!(updated.scene_number, 2);
        assert_eq!(updated.start_time, 60);
        assert_eq!(updated.end_time, 180);
    }

    #[tokio::test]
    async fn update_scene_partial() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        let updated = svc
            .update_scene(
                &scene.id,
                UpdateSceneRequest {
                    title: Some("New Title".into()),
                    scene_number: None,
                    description: None,
                    start_time: None,
                    end_time: None,
                },
                &owner_id,
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.start_time, 0);
        assert_eq!(updated.end_time, 120);
    }

    #[tokio::test]
    async fn update_scene_not_found() {
        let svc = make_svc(MockSceneRepo::new(), MockMovieRepo::new());
        let actor = UserId::new();
        let err = svc
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

    #[tokio::test]
    async fn update_scene_empty_title() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        let err = svc
            .update_scene(
                &scene.id,
                UpdateSceneRequest {
                    title: Some("".into()),
                    scene_number: None,
                    description: None,
                    start_time: None,
                    end_time: None,
                },
                &owner_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn update_scene_invalid_times() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        let err = svc
            .update_scene(
                &scene.id,
                UpdateSceneRequest {
                    title: None,
                    scene_number: None,
                    description: None,
                    start_time: Some(200),
                    end_time: Some(100),
                },
                &owner_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // delete_scene
    // ========================================================================

    #[tokio::test]
    async fn delete_scene_success() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        svc.delete_scene(&scene.id, &owner_id).await.unwrap();
        let err = svc.get_scene(&scene.id).await.unwrap_err();
        assert_eq!(err.code, "scene.not_found");
    }

    #[tokio::test]
    async fn delete_scene_not_found() {
        let svc = make_svc(MockSceneRepo::new(), MockMovieRepo::new());
        let actor = UserId::new();
        let err = svc.delete_scene(&SceneId::new(), &actor).await.unwrap_err();
        assert_eq!(err.code, "scene.not_found");
    }

    // ========================================================================
    // duration_seconds
    // ========================================================================

    #[tokio::test]
    async fn scene_duration() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();
        assert_eq!(scene.duration_seconds(), 120);
    }

    // ========================================================================
    // Authorization
    // ========================================================================

    #[tokio::test]
    async fn create_scene_non_member_denied() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id),
        );
        let outsider = UserId::new();
        let err = svc
            .create_scene(create_req(movie.id.clone()), &outsider)
            .await
            .unwrap_err();
        assert_eq!(err.code, "scene.not_authorized");
    }

    #[tokio::test]
    async fn create_scene_viewer_denied() {
        let (movie, owner_id) = make_movie();
        let viewer_id = UserId::new();
        let movie_repo = MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id);
        movie_repo.members.lock().await.push(MovieMember {
            movie_id: movie.id.clone(),
            user_id: viewer_id.clone(),
            role: MovieRole::Viewer,
            joined_at: ChronoUtc::now(),
        });
        let svc = make_svc(MockSceneRepo::new(), movie_repo);

        let err = svc
            .create_scene(create_req(movie.id.clone()), &viewer_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "scene.not_authorized");
    }

    #[tokio::test]
    async fn update_scene_non_member_denied() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();

        let outsider = UserId::new();
        let err = svc
            .update_scene(
                &scene.id,
                UpdateSceneRequest {
                    title: Some("Nope".into()),
                    scene_number: None,
                    description: None,
                    start_time: None,
                    end_time: None,
                },
                &outsider,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "scene.not_authorized");
    }

    #[tokio::test]
    async fn delete_scene_non_member_denied() {
        let (movie, owner_id) = make_movie();
        let svc = make_svc(
            MockSceneRepo::new(),
            MockMovieRepo::with_movie_and_owner(movie.clone(), owner_id.clone()),
        );
        let scene = svc
            .create_scene(create_req(movie.id.clone()), &owner_id)
            .await
            .unwrap();

        let outsider = UserId::new();
        let err = svc.delete_scene(&scene.id, &outsider).await.unwrap_err();
        assert_eq!(err.code, "scene.not_authorized");
    }
}
