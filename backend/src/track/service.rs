use std::sync::Arc;

use chrono::Utc;

use crate::error::AppError;
use crate::iam::user::{UserRepository, UserRepositoryExt};
use crate::kernel::{TrackId, UserId};
use crate::movie::{MovieRepository, MovieRole};
use crate::scene::SceneRepository;
use crate::song::SongRepository;

use super::error::TrackError;
use super::model::{CreateTrackRequest, Track, TrackWithDetails, UpdateTrackRequest};
use super::port::TrackRepository;

pub struct TrackService {
    track_repo: Arc<dyn TrackRepository>,
    scene_repo: Arc<dyn SceneRepository>,
    song_repo: Arc<dyn SongRepository>,
    movie_repo: Arc<dyn MovieRepository>,
    user_repo: Arc<dyn UserRepository>,
}

impl TrackService {
    pub fn new(
        track_repo: Arc<dyn TrackRepository>,
        scene_repo: Arc<dyn SceneRepository>,
        song_repo: Arc<dyn SongRepository>,
        movie_repo: Arc<dyn MovieRepository>,
        user_repo: Arc<dyn UserRepository>,
    ) -> Self {
        Self {
            track_repo,
            scene_repo,
            song_repo,
            movie_repo,
            user_repo,
        }
    }

    // ========================================================================
    // Authorization helpers
    // ========================================================================

    /// Assert the actor is a movie team member with a write role,
    /// resolving scene → movie.
    async fn assert_movie_team(
        &self,
        scene_id: &crate::kernel::SceneId,
        actor: &UserId,
    ) -> Result<(), AppError> {
        let scene = self
            .scene_repo
            .get_by_id(scene_id)
            .await?
            .ok_or_else(|| AppError::not_found("Scene not found"))?;

        let member = self.movie_repo.get_member(&scene.movie_id, actor).await?;
        match member {
            Some(m) if m.role != MovieRole::Viewer => Ok(()),
            _ => Err(TrackError::not_authorized()),
        }
    }

    // ========================================================================
    // CRUD
    // ========================================================================

    pub async fn create_track(
        &self,
        req: CreateTrackRequest,
        created_by: UserId,
    ) -> Result<Track, AppError> {
        let usage_type = req.validate()?;

        self.scene_repo
            .get_by_id(&req.scene_id)
            .await?
            .ok_or_else(|| AppError::not_found("Scene not found"))?;

        self.assert_movie_team(&req.scene_id, &created_by).await?;

        let song = self
            .song_repo
            .get_by_id(&req.song_id)
            .await?
            .ok_or_else(|| AppError::not_found("Song not found"))?;

        if req.end_time_seconds > song.duration_seconds {
            return Err(
                AppError::validation("End time cannot exceed the song's duration")
                    .with_detail("field", "end_time_seconds"),
            );
        }

        // Check if song is already placed in this scene
        if self
            .track_repo
            .get_by_scene_and_song(&req.scene_id, &req.song_id)
            .await?
            .is_some()
        {
            return Err(TrackError::already_exists());
        }

        let mut track = Track::new(
            req.scene_id,
            req.song_id,
            usage_type,
            req.start_time_seconds,
            req.end_time_seconds,
            created_by,
        );
        track.notes = req.notes;

        self.track_repo.save(&track).await?;
        Ok(track)
    }

    pub async fn get_track(&self, id: &TrackId) -> Result<Track, AppError> {
        self.track_repo
            .get_by_id(id)
            .await?
            .ok_or_else(TrackError::not_found)
    }

    pub async fn list_by_scene(
        &self,
        scene_id: &crate::kernel::SceneId,
    ) -> Result<Vec<Track>, AppError> {
        self.track_repo.list_by_scene(scene_id).await
    }

    pub async fn list_by_song(
        &self,
        song_id: &crate::kernel::SongId,
    ) -> Result<Vec<Track>, AppError> {
        self.track_repo.list_by_song(song_id).await
    }

    pub async fn update_track(
        &self,
        id: &TrackId,
        req: UpdateTrackRequest,
        actor: &UserId,
    ) -> Result<Track, AppError> {
        let new_usage = req.validate()?;

        let track = self.get_track(id).await?;
        self.assert_movie_team(&track.scene_id, actor).await?;

        let mut track = track;

        if let Some(usage_type) = new_usage {
            track.usage_type = usage_type;
        }
        if let Some(start) = req.start_time_seconds {
            track.start_time_seconds = start;
        }
        if let Some(end) = req.end_time_seconds {
            track.end_time_seconds = end;
        }
        if track.end_time_seconds <= track.start_time_seconds {
            return Err(
                AppError::validation("End time must be greater than start time")
                    .with_detail("field", "end_time_seconds"),
            );
        }
        if let Some(song) = self.song_repo.get_by_id(&track.song_id).await?
            && track.end_time_seconds > song.duration_seconds
        {
            return Err(
                AppError::validation("End time cannot exceed the song's duration")
                    .with_detail("field", "end_time_seconds"),
            );
        }
        if let Some(notes) = req.notes {
            track.notes = Some(notes);
        }
        track.updated_at = Utc::now();

        self.track_repo.update(&track).await?;
        Ok(track)
    }

    pub async fn delete_track(&self, id: &TrackId, actor: &UserId) -> Result<(), AppError> {
        let track = self.get_track(id).await?;
        self.assert_movie_team(&track.scene_id, actor).await?;
        self.track_repo.delete(id).await
    }

    // ========================================================================
    // Response enrichment
    // ========================================================================

    pub async fn to_details(&self, tracks: &[Track]) -> Result<Vec<TrackWithDetails>, AppError> {
        let names = self
            .user_repo
            .resolve_names(tracks.iter().map(|t| t.created_by.clone()))
            .await?;
        Ok(tracks
            .iter()
            .cloned()
            .map(|t| {
                let created_by_name = names.get(&t.created_by).cloned();
                TrackWithDetails {
                    track: t,
                    created_by_name,
                }
            })
            .collect())
    }

    pub async fn to_detail(&self, track: Track) -> Result<TrackWithDetails, AppError> {
        Ok(self
            .to_details(std::slice::from_ref(&track))
            .await?
            .remove(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kernel::{LabelId, MovieId, SceneId, SongId, UserId};
    use crate::kernel::{Paginated, PaginationOptions};
    use crate::movie::{Movie, MovieFilter, MovieMember, MovieRepository, MovieRole};
    use crate::scene::{Scene, SceneRepository};
    use crate::song::{Song, SongFilter, SongRepository};
    use chrono::Utc as ChronoUtc;
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockTrackRepo {
        tracks: Mutex<Vec<Track>>,
    }
    impl MockTrackRepo {
        fn new() -> Self {
            Self {
                tracks: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl TrackRepository for MockTrackRepo {
        async fn save(&self, track: &Track) -> Result<(), AppError> {
            self.tracks.lock().await.push(track.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &TrackId) -> Result<Option<Track>, AppError> {
            let tracks = self.tracks.lock().await;
            Ok(tracks.iter().find(|t| t.id == *id).cloned())
        }
        async fn list_by_scene(&self, scene_id: &SceneId) -> Result<Vec<Track>, AppError> {
            let tracks = self.tracks.lock().await;
            Ok(tracks
                .iter()
                .filter(|t| t.scene_id == *scene_id)
                .cloned()
                .collect())
        }
        async fn list_by_song(&self, song_id: &SongId) -> Result<Vec<Track>, AppError> {
            let tracks = self.tracks.lock().await;
            Ok(tracks
                .iter()
                .filter(|t| t.song_id == *song_id)
                .cloned()
                .collect())
        }
        async fn get_by_scene_and_song(
            &self,
            scene_id: &SceneId,
            song_id: &SongId,
        ) -> Result<Option<Track>, AppError> {
            let tracks = self.tracks.lock().await;
            Ok(tracks
                .iter()
                .find(|t| t.scene_id == *scene_id && t.song_id == *song_id)
                .cloned())
        }
        async fn update(&self, track: &Track) -> Result<(), AppError> {
            let mut tracks = self.tracks.lock().await;
            if let Some(t) = tracks.iter_mut().find(|t| t.id == track.id) {
                *t = track.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &TrackId) -> Result<(), AppError> {
            self.tracks.lock().await.retain(|t| t.id != *id);
            Ok(())
        }
    }

    struct MockSceneRepo {
        scenes: Mutex<Vec<Scene>>,
    }
    impl MockSceneRepo {
        fn new() -> Self {
            Self {
                scenes: Mutex::new(Vec::new()),
            }
        }
        fn with_scene(scene: Scene) -> Self {
            Self {
                scenes: Mutex::new(vec![scene]),
            }
        }
    }
    #[async_trait::async_trait]
    impl SceneRepository for MockSceneRepo {
        async fn save(&self, _: &Scene) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &SceneId) -> Result<Option<Scene>, AppError> {
            let scenes = self.scenes.lock().await;
            Ok(scenes.iter().find(|s| s.id == *id).cloned())
        }
        async fn list_by_movie(&self, _: &MovieId) -> Result<Vec<Scene>, AppError> {
            Ok(vec![])
        }
        async fn update(&self, _: &Scene) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &SceneId) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockSongRepo {
        songs: Mutex<Vec<Song>>,
    }
    impl MockSongRepo {
        fn new() -> Self {
            Self {
                songs: Mutex::new(Vec::new()),
            }
        }
        fn with_song(song: Song) -> Self {
            Self {
                songs: Mutex::new(vec![song]),
            }
        }
    }
    #[async_trait::async_trait]
    impl SongRepository for MockSongRepo {
        async fn save(&self, _: &Song) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &SongId) -> Result<Option<Song>, AppError> {
            let songs = self.songs.lock().await;
            Ok(songs.iter().find(|s| s.id == *id).cloned())
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &SongFilter,
        ) -> Result<Paginated<Song>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn update(&self, _: &Song) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &SongId) -> Result<(), AppError> {
            Ok(())
        }
        async fn list_by_artist(&self, _: &UserId) -> Result<Vec<Song>, AppError> {
            Ok(vec![])
        }
        async fn list_by_label(&self, _: &LabelId) -> Result<Vec<Song>, AppError> {
            Ok(vec![])
        }
    }

    struct MockMovieRepo {
        members: Mutex<Vec<MovieMember>>,
    }
    impl MockMovieRepo {
        fn new() -> Self {
            Self {
                members: Mutex::new(Vec::new()),
            }
        }
        fn with_owner(movie_id: MovieId, owner_id: UserId) -> Self {
            Self {
                members: Mutex::new(vec![MovieMember {
                    movie_id,
                    user_id: owner_id,
                    role: MovieRole::Owner,
                    joined_at: ChronoUtc::now(),
                }]),
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
        async fn get_by_id(&self, _: &MovieId) -> Result<Option<Movie>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &MovieFilter,
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

    struct MockUserRepo;
    #[async_trait::async_trait]
    impl UserRepository for MockUserRepo {
        async fn get_by_id(&self, _: &UserId) -> Result<Option<crate::iam::user::User>, AppError> {
            Ok(None)
        }
        async fn get_by_ids(&self, _: &[UserId]) -> Result<Vec<crate::iam::user::User>, AppError> {
            Ok(vec![])
        }
        async fn get_by_email(&self, _: &str) -> Result<Option<crate::iam::user::User>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &crate::iam::user::UserFilter,
        ) -> Result<Paginated<crate::iam::user::User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn save(&self, _: &crate::iam::user::User) -> Result<(), AppError> {
            Ok(())
        }
        async fn update(&self, _: &crate::iam::user::User) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    fn make_scene() -> (Scene, MovieId) {
        let movie_id = MovieId::new();
        let scene = Scene::new(movie_id.clone(), "Opening".into(), 1, 0, 120);
        (scene, movie_id)
    }

    fn make_song() -> Song {
        Song::new("Test Song".into(), UserId::new(), None, 240)
    }

    fn make_svc(
        track_repo: MockTrackRepo,
        scene_repo: MockSceneRepo,
        song_repo: MockSongRepo,
        movie_repo: MockMovieRepo,
    ) -> TrackService {
        TrackService::new(
            Arc::new(track_repo),
            Arc::new(scene_repo),
            Arc::new(song_repo),
            Arc::new(movie_repo),
            Arc::new(MockUserRepo),
        )
    }

    fn create_req(scene_id: SceneId, song_id: SongId) -> CreateTrackRequest {
        CreateTrackRequest {
            scene_id,
            song_id,
            usage_type: "BACKGROUND".into(),
            start_time_seconds: 0,
            end_time_seconds: 60,
            notes: None,
        }
    }

    // ========================================================================
    // create_track
    // ========================================================================

    #[tokio::test]
    async fn create_track_success() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let track = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap();
        assert_eq!(track.scene_id, scene.id);
        assert_eq!(track.song_id, song.id);
        assert_eq!(track.usage_type, super::super::model::UsageType::Background);
        assert!(track.notes.is_none());
    }

    #[tokio::test]
    async fn create_track_with_notes() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.notes = Some("Plays softly in background".into());
        let track = svc.create_track(req, owner_id).await.unwrap();
        assert_eq!(track.notes.as_deref(), Some("Plays softly in background"));
    }

    #[tokio::test]
    async fn create_track_featured_usage() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.usage_type = "FEATURED".into();
        let track = svc.create_track(req, owner_id).await.unwrap();
        assert_eq!(track.usage_type, super::super::model::UsageType::Featured);
    }

    #[tokio::test]
    async fn create_track_invalid_usage_type() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.usage_type = "INVALID".into();
        let err = svc.create_track(req, owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_track_end_before_start() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.start_time_seconds = 30;
        req.end_time_seconds = 30;
        let err = svc.create_track(req, owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_track_end_exceeds_song_duration() {
        let (scene, movie_id) = make_scene();
        let song = make_song(); // duration_seconds = 240
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.end_time_seconds = 300;
        let err = svc.create_track(req, owner_id).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_track_range_must_fit_within_song_duration() {
        let (scene, movie_id) = make_scene();
        let song = Song::new("Short Song".into(), UserId::new(), None, 120);
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );

        // 100..150 does not fit within a 120s song -> rejected
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.start_time_seconds = 100;
        req.end_time_seconds = 150;
        let err = svc.create_track(req, owner_id.clone()).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");

        // 100..120 fits exactly -> accepted
        let mut req = create_req(scene.id.clone(), song.id.clone());
        req.start_time_seconds = 100;
        req.end_time_seconds = 120;
        let track = svc.create_track(req, owner_id).await.unwrap();
        assert_eq!(track.start_time_seconds, 100);
        assert_eq!(track.end_time_seconds, 120);
    }

    #[tokio::test]
    async fn create_track_scene_not_found() {
        let song = make_song();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::new(),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::new(),
        );
        let err = svc
            .create_track(create_req(SceneId::new(), song.id.clone()), UserId::new())
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_track_song_not_found() {
        let (scene, movie_id) = make_scene();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::new(),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let err = svc
            .create_track(create_req(scene.id.clone(), SongId::new()), owner_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_track_duplicate_song_in_scene() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        svc.create_track(
            create_req(scene.id.clone(), song.id.clone()),
            owner_id.clone(),
        )
        .await
        .unwrap();
        let err = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "track.already_exists");
    }

    // ========================================================================
    // get_track
    // ========================================================================

    #[tokio::test]
    async fn get_track_success() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap();
        let found = svc.get_track(&created.id).await.unwrap();
        assert_eq!(found.id, created.id);
    }

    #[tokio::test]
    async fn get_track_not_found() {
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::new(),
            MockSongRepo::new(),
            MockMovieRepo::new(),
        );
        let err = svc.get_track(&TrackId::new()).await.unwrap_err();
        assert_eq!(err.code, "track.not_found");
    }

    // ========================================================================
    // list_by_scene / list_by_song
    // ========================================================================

    #[tokio::test]
    async fn list_by_scene_success() {
        let (scene, movie_id) = make_scene();
        let song1 = make_song();
        let song2 = make_song();
        let owner_id = UserId::new();
        let song_repo = MockSongRepo {
            songs: Mutex::new(vec![song1.clone(), song2.clone()]),
        };
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            song_repo,
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        svc.create_track(
            create_req(scene.id.clone(), song1.id.clone()),
            owner_id.clone(),
        )
        .await
        .unwrap();
        let mut req2 = create_req(scene.id.clone(), song2.id.clone());
        req2.usage_type = "CREDITS".into();
        svc.create_track(req2, owner_id).await.unwrap();

        let tracks = svc.list_by_scene(&scene.id).await.unwrap();
        assert_eq!(tracks.len(), 2);
    }

    #[tokio::test]
    async fn list_by_song_success() {
        let (scene1, movie_id1) = make_scene();
        let (scene2, movie_id2) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let scene_repo = MockSceneRepo {
            scenes: Mutex::new(vec![scene1.clone(), scene2.clone()]),
        };
        let movie_repo = MockMovieRepo::new();
        movie_repo.members.lock().await.push(MovieMember {
            movie_id: movie_id1,
            user_id: owner_id.clone(),
            role: MovieRole::Owner,
            joined_at: ChronoUtc::now(),
        });
        movie_repo.members.lock().await.push(MovieMember {
            movie_id: movie_id2,
            user_id: owner_id.clone(),
            role: MovieRole::Owner,
            joined_at: ChronoUtc::now(),
        });
        let svc = make_svc(
            MockTrackRepo::new(),
            scene_repo,
            MockSongRepo::with_song(song.clone()),
            movie_repo,
        );
        svc.create_track(
            create_req(scene1.id.clone(), song.id.clone()),
            owner_id.clone(),
        )
        .await
        .unwrap();
        svc.create_track(create_req(scene2.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap();

        let tracks = svc.list_by_song(&song.id).await.unwrap();
        assert_eq!(tracks.len(), 2);
    }

    #[tokio::test]
    async fn list_by_scene_empty() {
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::new(),
            MockSongRepo::new(),
            MockMovieRepo::new(),
        );
        let tracks = svc.list_by_scene(&SceneId::new()).await.unwrap();
        assert!(tracks.is_empty());
    }

    // ========================================================================
    // update_track
    // ========================================================================

    #[tokio::test]
    async fn update_track_usage_type() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        let updated = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: None,
                    usage_type: Some("FEATURED".into()),
                    notes: None,
                },
                &owner_id,
            )
            .await
            .unwrap();
        assert_eq!(updated.usage_type, super::super::model::UsageType::Featured);
    }

    #[tokio::test]
    async fn update_track_times() {
        let (scene, movie_id) = make_scene();
        let song = make_song(); // duration_seconds = 240
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        let updated = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: Some(10),
                    end_time_seconds: Some(90),
                    usage_type: None,
                    notes: None,
                },
                &owner_id,
            )
            .await
            .unwrap();
        assert_eq!(updated.start_time_seconds, 10);
        assert_eq!(updated.end_time_seconds, 90);
    }

    #[tokio::test]
    async fn update_track_end_exceeds_song_duration() {
        let (scene, movie_id) = make_scene();
        let song = make_song(); // duration_seconds = 240
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        let err = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: Some(300),
                    usage_type: None,
                    notes: None,
                },
                &owner_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn update_track_notes() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        let updated = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: None,
                    usage_type: None,
                    notes: Some("Loud during chase".into()),
                },
                &owner_id,
            )
            .await
            .unwrap();
        assert_eq!(updated.notes.as_deref(), Some("Loud during chase"));
        assert_eq!(
            updated.usage_type,
            super::super::model::UsageType::Background
        );
    }

    #[tokio::test]
    async fn update_track_not_found() {
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::new(),
            MockSongRepo::new(),
            MockMovieRepo::new(),
        );
        let actor = UserId::new();
        let err = svc
            .update_track(
                &TrackId::new(),
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: None,
                    usage_type: Some("FEATURED".into()),
                    notes: None,
                },
                &actor,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "track.not_found");
    }

    #[tokio::test]
    async fn update_track_invalid_usage_type() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        let err = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: None,
                    usage_type: Some("NOPE".into()),
                    notes: None,
                },
                &owner_id,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // delete_track
    // ========================================================================

    #[tokio::test]
    async fn delete_track_success() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(
                create_req(scene.id.clone(), song.id.clone()),
                owner_id.clone(),
            )
            .await
            .unwrap();
        svc.delete_track(&created.id, &owner_id).await.unwrap();
        let err = svc.get_track(&created.id).await.unwrap_err();
        assert_eq!(err.code, "track.not_found");
    }

    #[tokio::test]
    async fn delete_track_not_found() {
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::new(),
            MockSongRepo::new(),
            MockMovieRepo::new(),
        );
        let actor = UserId::new();
        let err = svc.delete_track(&TrackId::new(), &actor).await.unwrap_err();
        assert_eq!(err.code, "track.not_found");
    }

    // ========================================================================
    // Authorization
    // ========================================================================

    #[tokio::test]
    async fn create_track_non_member_denied() {
        let (scene, _movie_id) = make_scene();
        let song = make_song();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::new(), // no members
        );
        let outsider = UserId::new();
        let err = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), outsider)
            .await
            .unwrap_err();
        assert_eq!(err.code, "track.not_authorized");
    }

    #[tokio::test]
    async fn create_track_viewer_denied() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let viewer_id = UserId::new();
        let movie_repo = MockMovieRepo::new();
        movie_repo.members.lock().await.push(MovieMember {
            movie_id,
            user_id: viewer_id.clone(),
            role: MovieRole::Viewer,
            joined_at: ChronoUtc::now(),
        });
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            movie_repo,
        );
        let err = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), viewer_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "track.not_authorized");
    }

    #[tokio::test]
    async fn update_track_non_member_denied() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap();

        let outsider = UserId::new();
        let err = svc
            .update_track(
                &created.id,
                UpdateTrackRequest {
                    start_time_seconds: None,
                    end_time_seconds: None,
                    usage_type: Some("FEATURED".into()),
                    notes: None,
                },
                &outsider,
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "track.not_authorized");
    }

    #[tokio::test]
    async fn delete_track_non_member_denied() {
        let (scene, movie_id) = make_scene();
        let song = make_song();
        let owner_id = UserId::new();
        let svc = make_svc(
            MockTrackRepo::new(),
            MockSceneRepo::with_scene(scene.clone()),
            MockSongRepo::with_song(song.clone()),
            MockMovieRepo::with_owner(movie_id, owner_id.clone()),
        );
        let created = svc
            .create_track(create_req(scene.id.clone(), song.id.clone()), owner_id)
            .await
            .unwrap();

        let outsider = UserId::new();
        let err = svc.delete_track(&created.id, &outsider).await.unwrap_err();
        assert_eq!(err.code, "track.not_authorized");
    }
}
