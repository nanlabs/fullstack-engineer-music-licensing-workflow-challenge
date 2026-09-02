use std::sync::Arc;

use chrono::Utc;

use crate::error::AppError;
use crate::iam::user::{UserRepository, UserRepositoryExt};
use crate::kernel::{LabelId, Paginated, PaginationOptions, SongId, UserId};
use crate::label::{LabelRepository, LabelRepositoryExt, LabelRole};

use super::error::SongError;
use super::model::{CreateSongRequest, Song, SongFilter, SongWithDetails, UpdateSongRequest};
use super::port::SongRepository;

pub struct SongService {
    song_repo: Arc<dyn SongRepository>,
    user_repo: Arc<dyn UserRepository>,
    label_repo: Arc<dyn LabelRepository>,
}

impl SongService {
    pub fn new(
        song_repo: Arc<dyn SongRepository>,
        user_repo: Arc<dyn UserRepository>,
        label_repo: Arc<dyn LabelRepository>,
    ) -> Self {
        Self {
            song_repo,
            user_repo,
            label_repo,
        }
    }

    pub async fn create_song(&self, req: CreateSongRequest) -> Result<Song, AppError> {
        req.validate()?;

        // Verify artist exists
        self.user_repo
            .get_by_id(&req.artist_id)
            .await?
            .ok_or_else(|| AppError::not_found("Artist not found"))?;

        // Verify label exists and artist belongs to it as ARTIST
        if let Some(ref label_id) = req.label_id {
            self.label_repo
                .get_by_id(label_id)
                .await?
                .ok_or_else(|| AppError::not_found("Label not found"))?;

            let member = self
                .label_repo
                .get_member(label_id, &req.artist_id)
                .await?
                .ok_or_else(|| {
                    AppError::validation("Artist is not a member of the specified label")
                })?;

            if member.role != LabelRole::Artist {
                return Err(AppError::validation(
                    "User is not registered as an artist in the specified label",
                ));
            }
        }

        let mut song = Song::new(req.title, req.artist_id, req.label_id, req.duration_seconds);
        song.album = req.album;
        song.genre = req.genre;
        song.isrc = req.isrc;

        self.song_repo.save(&song).await?;
        Ok(song)
    }

    pub async fn get_song(&self, id: &SongId) -> Result<Song, AppError> {
        self.song_repo
            .get_by_id(id)
            .await?
            .ok_or_else(SongError::not_found)
    }

    pub async fn find_songs(
        &self,
        opts: &PaginationOptions,
        filter: &SongFilter,
    ) -> Result<Paginated<Song>, AppError> {
        self.song_repo.find(opts, filter).await
    }

    pub async fn update_song(&self, id: &SongId, req: UpdateSongRequest) -> Result<Song, AppError> {
        req.validate()?;

        let mut song = self.get_song(id).await?;

        if let Some(title) = req.title {
            song.title = title;
        }
        if let Some(album) = req.album {
            song.album = Some(album);
        }
        if let Some(genre) = req.genre {
            song.genre = Some(genre);
        }
        if let Some(isrc) = req.isrc {
            song.isrc = Some(isrc);
        }
        if let Some(duration) = req.duration_seconds {
            song.duration_seconds = duration;
        }
        song.updated_at = Utc::now();

        self.song_repo.update(&song).await?;
        Ok(song)
    }

    pub async fn delete_song(&self, id: &SongId) -> Result<(), AppError> {
        self.get_song(id).await?;
        self.song_repo.delete(id).await
    }

    pub async fn list_by_artist(&self, artist_id: &UserId) -> Result<Vec<Song>, AppError> {
        self.song_repo.list_by_artist(artist_id).await
    }

    pub async fn list_by_label(&self, label_id: &LabelId) -> Result<Vec<Song>, AppError> {
        self.song_repo.list_by_label(label_id).await
    }

    /// Resolve `artist_name`/`label_name` for a batch of songs with one
    /// query per aggregate, regardless of how many songs are passed.
    pub async fn to_details(&self, songs: &[Song]) -> Result<Vec<SongWithDetails>, AppError> {
        let artist_names = self
            .user_repo
            .resolve_names(songs.iter().map(|s| s.artist_id.clone()))
            .await?;
        let label_names = self
            .label_repo
            .resolve_names(songs.iter().filter_map(|s| s.label_id.clone()))
            .await?;

        Ok(songs
            .iter()
            .map(|s| SongWithDetails {
                song: s.clone(),
                artist_name: artist_names.get(&s.artist_id).cloned(),
                label_name: s
                    .label_id
                    .as_ref()
                    .and_then(|id| label_names.get(id).cloned()),
            })
            .collect())
    }

    pub async fn to_detail(&self, song: &Song) -> Result<SongWithDetails, AppError> {
        Ok(self.to_details(std::slice::from_ref(song)).await?.remove(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iam::user::model::UserFilter;
    use crate::iam::user::{User, UserRepository};
    use crate::label::{Label, LabelMember};
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockSongRepo {
        songs: Mutex<Vec<Song>>,
    }
    impl MockSongRepo {
        fn new() -> Self {
            Self {
                songs: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl SongRepository for MockSongRepo {
        async fn save(&self, song: &Song) -> Result<(), AppError> {
            self.songs.lock().await.push(song.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &SongId) -> Result<Option<Song>, AppError> {
            Ok(self
                .songs
                .lock()
                .await
                .iter()
                .find(|s| s.id == *id)
                .cloned())
        }
        async fn find(
            &self,
            opts: &PaginationOptions,
            _filter: &SongFilter,
        ) -> Result<Paginated<Song>, AppError> {
            let songs = self.songs.lock().await;
            let total = songs.len() as i64;
            let start = opts.offset() as usize;
            let items: Vec<Song> = songs
                .iter()
                .skip(start)
                .take(opts.limit() as usize)
                .cloned()
                .collect();
            Ok(Paginated::new(items, opts.page, opts.page_size, total))
        }
        async fn update(&self, song: &Song) -> Result<(), AppError> {
            let mut songs = self.songs.lock().await;
            if let Some(s) = songs.iter_mut().find(|s| s.id == song.id) {
                *s = song.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &SongId) -> Result<(), AppError> {
            self.songs.lock().await.retain(|s| s.id != *id);
            Ok(())
        }
        async fn list_by_artist(&self, artist_id: &UserId) -> Result<Vec<Song>, AppError> {
            Ok(self
                .songs
                .lock()
                .await
                .iter()
                .filter(|s| s.artist_id == *artist_id)
                .cloned()
                .collect())
        }
        async fn list_by_label(&self, label_id: &LabelId) -> Result<Vec<Song>, AppError> {
            Ok(self
                .songs
                .lock()
                .await
                .iter()
                .filter(|s| s.label_id.as_ref() == Some(label_id))
                .cloned()
                .collect())
        }
    }

    struct MockUserRepo {
        users: Mutex<Vec<User>>,
    }
    impl MockUserRepo {
        fn new() -> Self {
            Self {
                users: Mutex::new(Vec::new()),
            }
        }
        fn with_user(user: User) -> Self {
            Self {
                users: Mutex::new(vec![user]),
            }
        }
    }
    #[async_trait::async_trait]
    impl UserRepository for MockUserRepo {
        async fn get_by_id(&self, id: &UserId) -> Result<Option<User>, AppError> {
            Ok(self
                .users
                .lock()
                .await
                .iter()
                .find(|u| u.id == *id)
                .cloned())
        }
        async fn get_by_ids(&self, ids: &[UserId]) -> Result<Vec<User>, AppError> {
            Ok(self
                .users
                .lock()
                .await
                .iter()
                .filter(|u| ids.contains(&u.id))
                .cloned()
                .collect())
        }
        async fn get_by_email(&self, _: &str) -> Result<Option<User>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn save(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn update(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockLabelRepo {
        labels: Mutex<Vec<Label>>,
        members: Mutex<Vec<LabelMember>>,
    }
    impl MockLabelRepo {
        fn new() -> Self {
            Self {
                labels: Mutex::new(Vec::new()),
                members: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl LabelRepository for MockLabelRepo {
        async fn save(&self, label: &Label) -> Result<(), AppError> {
            self.labels.lock().await.push(label.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &LabelId) -> Result<Option<Label>, AppError> {
            Ok(self
                .labels
                .lock()
                .await
                .iter()
                .find(|l| l.id == *id)
                .cloned())
        }
        async fn get_by_ids(&self, ids: &[LabelId]) -> Result<Vec<Label>, AppError> {
            Ok(self
                .labels
                .lock()
                .await
                .iter()
                .filter(|l| ids.contains(&l.id))
                .cloned()
                .collect())
        }
        async fn get_by_name(&self, _: &str) -> Result<Option<Label>, AppError> {
            Ok(None)
        }
        async fn list_all(&self) -> Result<Vec<Label>, AppError> {
            Ok(vec![])
        }
        async fn update(&self, _: &Label) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &LabelId) -> Result<(), AppError> {
            Ok(())
        }
        async fn add_member(&self, _: &LabelMember) -> Result<(), AppError> {
            Ok(())
        }
        async fn remove_member(&self, _: &LabelId, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_member(
            &self,
            label_id: &LabelId,
            user_id: &UserId,
        ) -> Result<Option<LabelMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .find(|m| m.label_id == *label_id && m.user_id == *user_id)
                .cloned())
        }
        async fn list_members(&self, _: &LabelId) -> Result<Vec<LabelMember>, AppError> {
            Ok(vec![])
        }
        async fn get_user_labels(&self, _: &UserId) -> Result<Vec<Label>, AppError> {
            Ok(vec![])
        }
    }

    fn make_user() -> User {
        User::new_with_password("artist@example.com".into(), "Artist".into(), "hash".into())
    }

    fn make_label() -> Label {
        Label::new("Test Label".into(), None, None)
    }

    fn make_member(label_id: LabelId, user_id: UserId, role: LabelRole) -> LabelMember {
        LabelMember {
            label_id,
            user_id,
            role,
            joined_at: Utc::now(),
        }
    }

    fn make_create_req(artist_id: UserId) -> CreateSongRequest {
        CreateSongRequest {
            title: "Test Song".into(),
            artist_id,
            label_id: None,
            album: Some("Album".into()),
            duration_seconds: 240,
            genre: Some("Rock".into()),
            isrc: Some("US1234567890".into()),
        }
    }

    fn make_svc(
        song_repo: MockSongRepo,
        user_repo: MockUserRepo,
        label_repo: MockLabelRepo,
    ) -> SongService {
        SongService::new(
            Arc::new(song_repo),
            Arc::new(user_repo),
            Arc::new(label_repo),
        )
    }

    // ========================================================================
    // create_song
    // ========================================================================

    #[tokio::test]
    async fn create_song_no_label() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        assert_eq!(song.title, "Test Song");
        assert!(song.label_id.is_none());
    }

    #[tokio::test]
    async fn create_song_with_label() {
        let user = make_user();
        let label = make_label();
        let label_repo = MockLabelRepo::new();
        label_repo.labels.lock().await.push(label.clone());
        label_repo.members.lock().await.push(make_member(
            label.id.clone(),
            user.id.clone(),
            LabelRole::Artist,
        ));

        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            label_repo,
        );
        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(label.id.clone());
        let song = svc.create_song(req).await.unwrap();
        assert_eq!(song.label_id.as_ref().unwrap().as_str(), label.id.as_str());
    }

    #[tokio::test]
    async fn create_song_artist_not_found() {
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::new(),
            MockLabelRepo::new(),
        );
        let err = svc
            .create_song(make_create_req(UserId::new()))
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_song_label_not_found() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(LabelId::new());
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_song_artist_not_member_of_label() {
        let user = make_user();
        let label = make_label();
        let label_repo = MockLabelRepo::new();
        label_repo.labels.lock().await.push(label.clone());
        // No member added

        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            label_repo,
        );
        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(label.id.clone());
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
        assert!(err.message.contains("not a member"));
    }

    #[tokio::test]
    async fn create_song_member_wrong_role() {
        let user = make_user();
        let label = make_label();
        let label_repo = MockLabelRepo::new();
        label_repo.labels.lock().await.push(label.clone());
        label_repo.members.lock().await.push(make_member(
            label.id.clone(),
            user.id.clone(),
            LabelRole::Rep,
        ));

        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            label_repo,
        );
        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(label.id.clone());
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
        assert!(err.message.contains("not registered as an artist"));
    }

    #[tokio::test]
    async fn create_song_owner_cannot_be_artist() {
        let user = make_user();
        let label = make_label();
        let label_repo = MockLabelRepo::new();
        label_repo.labels.lock().await.push(label.clone());
        label_repo.members.lock().await.push(make_member(
            label.id.clone(),
            user.id.clone(),
            LabelRole::Owner,
        ));

        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            label_repo,
        );
        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(label.id.clone());
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_song_empty_title() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let mut req = make_create_req(user.id.clone());
        req.title = "  ".into();
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_song_zero_duration() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let mut req = make_create_req(user.id.clone());
        req.duration_seconds = 0;
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_song_negative_duration() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let mut req = make_create_req(user.id.clone());
        req.duration_seconds = -5;
        let err = svc.create_song(req).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_song / find_songs / list
    // ========================================================================

    #[tokio::test]
    async fn get_song_success() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let created = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let found = svc.get_song(&created.id).await.unwrap();
        assert_eq!(found.title, "Test Song");
    }

    #[tokio::test]
    async fn get_song_not_found() {
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::new(),
            MockLabelRepo::new(),
        );
        let err = svc.get_song(&SongId::new()).await.unwrap_err();
        assert_eq!(err.code, "song.not_found");
    }

    #[tokio::test]
    async fn find_songs_paginated() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        for _ in 0..3 {
            svc.create_song(make_create_req(user.id.clone()))
                .await
                .unwrap();
        }
        let result = svc
            .find_songs(
                &PaginationOptions {
                    page: 1,
                    page_size: 10,
                },
                &SongFilter::default(),
            )
            .await
            .unwrap();
        assert_eq!(result.items.len(), 3);
        assert_eq!(result.pagination.total, 3);
    }

    #[tokio::test]
    async fn list_by_artist_success() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        svc.create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        svc.create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let songs = svc.list_by_artist(&user.id).await.unwrap();
        assert_eq!(songs.len(), 2);
    }

    #[tokio::test]
    async fn list_by_label_success() {
        let user = make_user();
        let label = make_label();
        let label_repo = MockLabelRepo::new();
        label_repo.labels.lock().await.push(label.clone());
        label_repo.members.lock().await.push(make_member(
            label.id.clone(),
            user.id.clone(),
            LabelRole::Artist,
        ));

        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            label_repo,
        );

        let mut req = make_create_req(user.id.clone());
        req.label_id = Some(label.id.clone());
        svc.create_song(req).await.unwrap();
        // Song without label
        svc.create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();

        let songs = svc.list_by_label(&label.id).await.unwrap();
        assert_eq!(songs.len(), 1);
    }

    // ========================================================================
    // update_song
    // ========================================================================

    #[tokio::test]
    async fn update_song_success() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let updated = svc
            .update_song(
                &song.id,
                UpdateSongRequest {
                    title: Some("New Title".into()),
                    album: Some("New Album".into()),
                    genre: Some("Jazz".into()),
                    isrc: Some("GB999".into()),
                    duration_seconds: Some(300),
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.album.as_deref(), Some("New Album"));
        assert_eq!(updated.genre.as_deref(), Some("Jazz"));
        assert_eq!(updated.duration_seconds, 300);
    }

    #[tokio::test]
    async fn update_song_partial() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let updated = svc
            .update_song(
                &song.id,
                UpdateSongRequest {
                    title: Some("New".into()),
                    album: None,
                    genre: None,
                    isrc: None,
                    duration_seconds: None,
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.title, "New");
        assert_eq!(updated.album.as_deref(), Some("Album"));
        assert_eq!(updated.duration_seconds, 240);
    }

    #[tokio::test]
    async fn update_song_not_found() {
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::new(),
            MockLabelRepo::new(),
        );
        let err = svc
            .update_song(
                &SongId::new(),
                UpdateSongRequest {
                    title: Some("X".into()),
                    album: None,
                    genre: None,
                    isrc: None,
                    duration_seconds: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "song.not_found");
    }

    #[tokio::test]
    async fn update_song_empty_title() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let err = svc
            .update_song(
                &song.id,
                UpdateSongRequest {
                    title: Some("".into()),
                    album: None,
                    genre: None,
                    isrc: None,
                    duration_seconds: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn update_song_invalid_duration() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        let err = svc
            .update_song(
                &song.id,
                UpdateSongRequest {
                    title: None,
                    album: None,
                    genre: None,
                    isrc: None,
                    duration_seconds: Some(0),
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // delete_song
    // ========================================================================

    #[tokio::test]
    async fn delete_song_success() {
        let user = make_user();
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::with_user(user.clone()),
            MockLabelRepo::new(),
        );
        let song = svc
            .create_song(make_create_req(user.id.clone()))
            .await
            .unwrap();
        svc.delete_song(&song.id).await.unwrap();
        let err = svc.get_song(&song.id).await.unwrap_err();
        assert_eq!(err.code, "song.not_found");
    }

    #[tokio::test]
    async fn delete_song_not_found() {
        let svc = make_svc(
            MockSongRepo::new(),
            MockUserRepo::new(),
            MockLabelRepo::new(),
        );
        let err = svc.delete_song(&SongId::new()).await.unwrap_err();
        assert_eq!(err.code, "song.not_found");
    }
}
