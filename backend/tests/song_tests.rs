mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::{LabelId, SongId, UserId};
use backend::label::adapters::PostgresLabelRepository;
use backend::label::{AddMemberRequest, CreateLabelRequest, LabelRepository, LabelService};
use backend::song::adapters::PostgresSongRepository;
use backend::song::{
    CreateSongRequest, SongFilter, SongRepository, SongService, UpdateSongRequest,
};

use common::TestDb;

struct TestContext {
    song_svc: SongService,
    song_repo: Arc<PostgresSongRepository>,
    label_svc: LabelService,
    label_repo: Arc<PostgresLabelRepository>,
    user_repo: Arc<PostgresUserRepository>,
    password_svc: Arc<BcryptPasswordService>,
    _db: TestDb,
}

impl TestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let label_repo = Arc::new(PostgresLabelRepository::new(db.pool.clone()));
        let song_repo = Arc::new(PostgresSongRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let label_svc = LabelService::new(label_repo.clone(), user_repo.clone());
        let song_svc = SongService::new(song_repo.clone(), user_repo.clone(), label_repo.clone());

        Self {
            song_svc,
            song_repo,
            label_svc,
            label_repo,
            user_repo,
            password_svc,
            _db: db,
        }
    }

    async fn create_user(&self, email: &str) -> User {
        let hash = self.password_svc.hash_password("password123").unwrap();
        let mut user = User::new_with_password(email.into(), "Test User".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    async fn create_label_with_artist(
        &self,
        label_name: &str,
        artist: &User,
    ) -> backend::label::Label {
        let label = self
            .label_svc
            .create_label(CreateLabelRequest {
                name: label_name.into(),
                website: None,
                contact_email: None,
            })
            .await
            .unwrap();

        self.label_svc
            .add_member(
                &label.id,
                AddMemberRequest {
                    user_id: artist.id.clone(),
                    role: Some("ARTIST".into()),
                },
            )
            .await
            .unwrap();

        label
    }

    fn make_create_req(&self, artist_id: UserId) -> CreateSongRequest {
        CreateSongRequest {
            title: "Test Song".into(),
            artist_id,
            label_id: None,
            album: Some("Test Album".into()),
            duration_seconds: 240,
            genre: Some("Rock".into()),
            isrc: Some("US1234567890".into()),
        }
    }
}

// ============================================================================
// Repository: Song CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("artist@example.com").await;

    let song = backend::song::Song::new("My Song".into(), user.id.clone(), None, 180);
    ctx.song_repo.save(&song).await.unwrap();

    let found = ctx.song_repo.get_by_id(&song.id).await.unwrap().unwrap();
    assert_eq!(found.title, "My Song");
    assert_eq!(found.artist_id.as_str(), user.id.as_str());
    assert_eq!(found.duration_seconds, 180);
    assert!(found.label_id.is_none());
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx.song_repo.get_by_id(&SongId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("artist@example.com").await;

    let mut song = backend::song::Song::new("Old Title".into(), user.id.clone(), None, 180);
    ctx.song_repo.save(&song).await.unwrap();

    song.title = "New Title".into();
    song.album = Some("New Album".into());
    song.genre = Some("Jazz".into());
    ctx.song_repo.update(&song).await.unwrap();

    let found = ctx.song_repo.get_by_id(&song.id).await.unwrap().unwrap();
    assert_eq!(found.title, "New Title");
    assert_eq!(found.album.as_deref(), Some("New Album"));
    assert_eq!(found.genre.as_deref(), Some("Jazz"));
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("artist@example.com").await;

    let song = backend::song::Song::new("Delete Me".into(), user.id.clone(), None, 120);
    ctx.song_repo.save(&song).await.unwrap();

    ctx.song_repo.delete(&song.id).await.unwrap();
    assert!(ctx.song_repo.get_by_id(&song.id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_repo_list_by_artist() {
    let ctx = TestContext::new().await;
    let artist1 = ctx.create_user("artist1@example.com").await;
    let artist2 = ctx.create_user("artist2@example.com").await;

    ctx.song_repo
        .save(&backend::song::Song::new(
            "Song A".into(),
            artist1.id.clone(),
            None,
            100,
        ))
        .await
        .unwrap();
    ctx.song_repo
        .save(&backend::song::Song::new(
            "Song B".into(),
            artist1.id.clone(),
            None,
            200,
        ))
        .await
        .unwrap();
    ctx.song_repo
        .save(&backend::song::Song::new(
            "Song C".into(),
            artist2.id.clone(),
            None,
            300,
        ))
        .await
        .unwrap();

    let songs = ctx.song_repo.list_by_artist(&artist1.id).await.unwrap();
    assert_eq!(songs.len(), 2);
}

#[tokio::test]
async fn test_repo_list_by_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let label = ctx.create_label_with_artist("My Label", &artist).await;

    let song1 = backend::song::Song::new(
        "Song A".into(),
        artist.id.clone(),
        Some(label.id.clone()),
        100,
    );
    let song2 = backend::song::Song::new("Song B".into(), artist.id.clone(), None, 200);
    ctx.song_repo.save(&song1).await.unwrap();
    ctx.song_repo.save(&song2).await.unwrap();

    let songs = ctx.song_repo.list_by_label(&label.id).await.unwrap();
    assert_eq!(songs.len(), 1);
    assert_eq!(songs[0].title, "Song A");
}

#[tokio::test]
async fn test_repo_find_with_search_filter() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    ctx.song_repo
        .save(&backend::song::Song::new(
            "Bohemian Rhapsody".into(),
            artist.id.clone(),
            None,
            355,
        ))
        .await
        .unwrap();
    ctx.song_repo
        .save(&backend::song::Song::new(
            "Hotel California".into(),
            artist.id.clone(),
            None,
            390,
        ))
        .await
        .unwrap();

    let filter = SongFilter {
        search: Some("bohemian".into()),
        ..Default::default()
    };
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx.song_repo.find(&opts, &filter).await.unwrap();
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].title, "Bohemian Rhapsody");
}

#[tokio::test]
async fn test_repo_find_with_genre_filter() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let mut s1 = backend::song::Song::new("Rock Song".into(), artist.id.clone(), None, 200);
    s1.genre = Some("Rock".into());
    let mut s2 = backend::song::Song::new("Jazz Song".into(), artist.id.clone(), None, 300);
    s2.genre = Some("Jazz".into());
    ctx.song_repo.save(&s1).await.unwrap();
    ctx.song_repo.save(&s2).await.unwrap();

    let filter = SongFilter {
        genre: Some("Jazz".into()),
        ..Default::default()
    };
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx.song_repo.find(&opts, &filter).await.unwrap();
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].title, "Jazz Song");
}

#[tokio::test]
async fn test_repo_find_with_artist_filter() {
    let ctx = TestContext::new().await;
    let artist1 = ctx.create_user("artist1@example.com").await;
    let artist2 = ctx.create_user("artist2@example.com").await;

    ctx.song_repo
        .save(&backend::song::Song::new(
            "A1".into(),
            artist1.id.clone(),
            None,
            100,
        ))
        .await
        .unwrap();
    ctx.song_repo
        .save(&backend::song::Song::new(
            "A2".into(),
            artist2.id.clone(),
            None,
            200,
        ))
        .await
        .unwrap();

    let filter = SongFilter {
        artist_id: Some(artist1.id.clone()),
        ..Default::default()
    };
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx.song_repo.find(&opts, &filter).await.unwrap();
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].title, "A1");
}

#[tokio::test]
async fn test_repo_find_pagination() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    for i in 1..=5 {
        ctx.song_repo
            .save(&backend::song::Song::new(
                format!("Song {i}"),
                artist.id.clone(),
                None,
                100 * i,
            ))
            .await
            .unwrap();
    }

    // Filter by our artist so seeded songs (migration 004) don't count.
    let filter = SongFilter {
        artist_id: Some(artist.id.clone()),
        ..Default::default()
    };
    let page1 = ctx
        .song_repo
        .find(
            &backend::kernel::PaginationOptions {
                page: 1,
                page_size: 2,
            },
            &filter,
        )
        .await
        .unwrap();
    assert_eq!(page1.items.len(), 2);
    assert_eq!(page1.pagination.total, 5);
    assert_eq!(page1.pagination.pages, 3);

    let page3 = ctx
        .song_repo
        .find(
            &backend::kernel::PaginationOptions {
                page: 3,
                page_size: 2,
            },
            &filter,
        )
        .await
        .unwrap();
    assert_eq!(page3.items.len(), 1);
}

#[tokio::test]
async fn test_repo_save_with_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let label = ctx.create_label_with_artist("Label", &artist).await;

    let song = backend::song::Song::new(
        "Labeled Song".into(),
        artist.id.clone(),
        Some(label.id.clone()),
        200,
    );
    ctx.song_repo.save(&song).await.unwrap();

    let found = ctx.song_repo.get_by_id(&song.id).await.unwrap().unwrap();
    assert_eq!(found.label_id.as_ref().unwrap().as_str(), label.id.as_str());
}

// ============================================================================
// Service: Create Song
// ============================================================================

#[tokio::test]
async fn test_service_create_song_no_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    assert_eq!(song.title, "Test Song");
    assert_eq!(song.artist_id.as_str(), artist.id.as_str());
    assert!(song.label_id.is_none());
    assert_eq!(song.album.as_deref(), Some("Test Album"));
    assert_eq!(song.duration_seconds, 240);
    assert_eq!(song.genre.as_deref(), Some("Rock"));
    assert_eq!(song.isrc.as_deref(), Some("US1234567890"));
}

#[tokio::test]
async fn test_service_create_song_with_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let label = ctx.create_label_with_artist("Sony", &artist).await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.label_id = Some(label.id.clone());

    let song = ctx.song_svc.create_song(req).await.unwrap();
    assert_eq!(song.label_id.as_ref().unwrap().as_str(), label.id.as_str());
}

#[tokio::test]
async fn test_service_create_song_artist_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx
        .song_svc
        .create_song(ctx.make_create_req(UserId::new()))
        .await
        .unwrap_err();

    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_song_label_not_found() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.label_id = Some(LabelId::new());

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_song_artist_not_member_of_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let other = ctx.create_user("other@example.com").await;
    let label = ctx.create_label_with_artist("Label", &other).await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.label_id = Some(label.id.clone());

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
    assert!(err.message.contains("not a member"));
}

#[tokio::test]
async fn test_service_create_song_member_but_not_artist_role() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("rep@example.com").await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    // Add as Rep, not Artist
    ctx.label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: Some("REP".into()),
            },
        )
        .await
        .unwrap();

    let mut req = ctx.make_create_req(user.id.clone());
    req.label_id = Some(label.id.clone());

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
    assert!(err.message.contains("not registered as an artist"));
}

#[tokio::test]
async fn test_service_create_song_owner_cannot_be_artist() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("owner@example.com").await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    ctx.label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: Some("OWNER".into()),
            },
        )
        .await
        .unwrap();

    let mut req = ctx.make_create_req(user.id.clone());
    req.label_id = Some(label.id.clone());

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_create_song_empty_title() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.title = "  ".into();

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_create_song_zero_duration() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.duration_seconds = 0;

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_create_song_negative_duration() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.duration_seconds = -10;

    let err = ctx.song_svc.create_song(req).await.unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

// ============================================================================
// Service: Get / Find / List
// ============================================================================

#[tokio::test]
async fn test_service_get_song() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let created = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();
    let found = ctx.song_svc.get_song(&created.id).await.unwrap();

    assert_eq!(found.id.as_str(), created.id.as_str());
    assert_eq!(found.title, "Test Song");
}

#[tokio::test]
async fn test_service_get_song_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx.song_svc.get_song(&SongId::new()).await.unwrap_err();
    assert_eq!(err.code, "song.not_found");
}

#[tokio::test]
async fn test_service_find_songs() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    for i in 1..=3 {
        let mut req = ctx.make_create_req(artist.id.clone());
        req.title = format!("Song {i}");
        ctx.song_svc.create_song(req).await.unwrap();
    }

    // Filter by our artist so seeded songs (migration 004) don't count.
    let result = ctx
        .song_svc
        .find_songs(
            &backend::kernel::PaginationOptions {
                page: 1,
                page_size: 10,
            },
            &SongFilter {
                artist_id: Some(artist.id.clone()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

    assert_eq!(result.items.len(), 3);
    assert_eq!(result.pagination.total, 3);
}

#[tokio::test]
async fn test_service_list_by_artist() {
    let ctx = TestContext::new().await;
    let artist1 = ctx.create_user("artist1@example.com").await;
    let artist2 = ctx.create_user("artist2@example.com").await;

    ctx.song_svc
        .create_song(ctx.make_create_req(artist1.id.clone()))
        .await
        .unwrap();
    ctx.song_svc
        .create_song(ctx.make_create_req(artist1.id.clone()))
        .await
        .unwrap();
    ctx.song_svc
        .create_song(ctx.make_create_req(artist2.id.clone()))
        .await
        .unwrap();

    let songs = ctx.song_svc.list_by_artist(&artist1.id).await.unwrap();
    assert_eq!(songs.len(), 2);
}

#[tokio::test]
async fn test_service_list_by_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let label = ctx.create_label_with_artist("My Label", &artist).await;

    let mut req1 = ctx.make_create_req(artist.id.clone());
    req1.label_id = Some(label.id.clone());
    ctx.song_svc.create_song(req1).await.unwrap();

    // Song without label
    ctx.song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    let songs = ctx.song_svc.list_by_label(&label.id).await.unwrap();
    assert_eq!(songs.len(), 1);
}

// ============================================================================
// Service: Update Song
// ============================================================================

#[tokio::test]
async fn test_service_update_song() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    let updated = ctx
        .song_svc
        .update_song(
            &song.id,
            UpdateSongRequest {
                title: Some("Updated Title".into()),
                album: Some("Updated Album".into()),
                genre: Some("Pop".into()),
                isrc: Some("GB9999999999".into()),
                duration_seconds: Some(300),
            },
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Updated Title");
    assert_eq!(updated.album.as_deref(), Some("Updated Album"));
    assert_eq!(updated.genre.as_deref(), Some("Pop"));
    assert_eq!(updated.isrc.as_deref(), Some("GB9999999999"));
    assert_eq!(updated.duration_seconds, 300);
    assert!(updated.updated_at > song.updated_at);
}

#[tokio::test]
async fn test_service_update_song_partial() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    let updated = ctx
        .song_svc
        .update_song(
            &song.id,
            UpdateSongRequest {
                title: Some("Only Title Changed".into()),
                album: None,
                genre: None,
                isrc: None,
                duration_seconds: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Only Title Changed");
    assert_eq!(updated.album.as_deref(), Some("Test Album"));
    assert_eq!(updated.genre.as_deref(), Some("Rock"));
    assert_eq!(updated.duration_seconds, 240);
}

#[tokio::test]
async fn test_service_update_song_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx
        .song_svc
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
async fn test_service_update_song_empty_title() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    let err = ctx
        .song_svc
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
async fn test_service_update_song_invalid_duration() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    let err = ctx
        .song_svc
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

// ============================================================================
// Service: Delete Song
// ============================================================================

#[tokio::test]
async fn test_service_delete_song() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    let song = ctx
        .song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();
    ctx.song_svc.delete_song(&song.id).await.unwrap();

    let err = ctx.song_svc.get_song(&song.id).await.unwrap_err();
    assert_eq!(err.code, "song.not_found");
}

#[tokio::test]
async fn test_service_delete_song_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx.song_svc.delete_song(&SongId::new()).await.unwrap_err();
    assert_eq!(err.code, "song.not_found");
}

// ============================================================================
// Cascade behavior
// ============================================================================

#[tokio::test]
async fn test_delete_artist_cascades_songs() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;

    ctx.song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();
    ctx.song_svc
        .create_song(ctx.make_create_req(artist.id.clone()))
        .await
        .unwrap();

    // Delete the artist
    ctx.user_repo.delete(&artist.id).await.unwrap();

    // Songs should be gone (ON DELETE CASCADE)
    let songs = ctx.song_repo.list_by_artist(&artist.id).await.unwrap();
    assert_eq!(songs.len(), 0);
}

#[tokio::test]
async fn test_delete_label_nullifies_song_label() {
    let ctx = TestContext::new().await;
    let artist = ctx.create_user("artist@example.com").await;
    let label = ctx.create_label_with_artist("Label", &artist).await;

    let mut req = ctx.make_create_req(artist.id.clone());
    req.label_id = Some(label.id.clone());
    let song = ctx.song_svc.create_song(req).await.unwrap();

    // Delete the label
    ctx.label_repo.delete(&label.id).await.unwrap();

    // Song should still exist, but label_id should be NULL (ON DELETE SET NULL)
    let found = ctx.song_svc.get_song(&song.id).await.unwrap();
    assert!(found.label_id.is_none());
}
