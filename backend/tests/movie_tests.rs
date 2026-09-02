mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::{MovieId, UserId};
use backend::movie::adapters::PostgresMovieRepository;
use backend::movie::{
    AddMovieMemberRequest, CreateMovieRequest, MovieFilter, MovieRepository, MovieRole,
    MovieService, UpdateMovieRequest,
};

use common::TestDb;

struct TestContext {
    movie_svc: MovieService,
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
        let password_svc = Arc::new(BcryptPasswordService::new());
        let movie_svc = MovieService::new(movie_repo.clone(), user_repo.clone());

        Self {
            movie_svc,
            movie_repo,
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

    fn create_req(&self, title: &str) -> CreateMovieRequest {
        CreateMovieRequest {
            title: title.into(),
            description: Some("A great movie".into()),
            release_year: Some(2024),
            director: Some("Spielberg".into()),
        }
    }
}

// ============================================================================
// Repository: CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let mut movie = backend::movie::Movie::new("Test Movie".into(), user.id.clone());
    movie.description = Some("Desc".into());
    movie.release_year = Some(2024);
    movie.director = Some("Director".into());
    ctx.movie_repo.save(&movie).await.unwrap();

    let found = ctx.movie_repo.get_by_id(&movie.id).await.unwrap().unwrap();
    assert_eq!(found.title, "Test Movie");
    assert_eq!(found.description.as_deref(), Some("Desc"));
    assert_eq!(found.release_year, Some(2024));
    assert_eq!(found.director.as_deref(), Some("Director"));
    assert_eq!(found.created_by.as_str(), user.id.as_str());
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx.movie_repo.get_by_id(&MovieId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let mut movie = backend::movie::Movie::new("Old".into(), user.id.clone());
    ctx.movie_repo.save(&movie).await.unwrap();

    movie.title = "New".into();
    movie.description = Some("Updated".into());
    movie.release_year = Some(2025);
    ctx.movie_repo.update(&movie).await.unwrap();

    let found = ctx.movie_repo.get_by_id(&movie.id).await.unwrap().unwrap();
    assert_eq!(found.title, "New");
    assert_eq!(found.description.as_deref(), Some("Updated"));
    assert_eq!(found.release_year, Some(2025));
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let movie = backend::movie::Movie::new("Delete Me".into(), user.id.clone());
    ctx.movie_repo.save(&movie).await.unwrap();

    ctx.movie_repo.delete(&movie.id).await.unwrap();
    assert!(ctx.movie_repo.get_by_id(&movie.id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_repo_list_by_user() {
    let ctx = TestContext::new().await;
    let user1 = ctx.create_user("u1@example.com").await;
    let user2 = ctx.create_user("u2@example.com").await;

    ctx.movie_repo
        .save(&backend::movie::Movie::new("M1".into(), user1.id.clone()))
        .await
        .unwrap();
    ctx.movie_repo
        .save(&backend::movie::Movie::new("M2".into(), user1.id.clone()))
        .await
        .unwrap();
    ctx.movie_repo
        .save(&backend::movie::Movie::new("M3".into(), user2.id.clone()))
        .await
        .unwrap();

    let movies = ctx.movie_repo.list_by_user(&user1.id).await.unwrap();
    assert_eq!(movies.len(), 2);
}

#[tokio::test]
async fn test_repo_find_with_search() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    ctx.movie_repo
        .save(&backend::movie::Movie::new(
            "Inception".into(),
            user.id.clone(),
        ))
        .await
        .unwrap();
    ctx.movie_repo
        .save(&backend::movie::Movie::new(
            "Interstellar".into(),
            user.id.clone(),
        ))
        .await
        .unwrap();

    let filter = MovieFilter {
        search: Some("incep".into()),
        ..Default::default()
    };
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx.movie_repo.find(&opts, &filter).await.unwrap();
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].title, "Inception");
}

#[tokio::test]
async fn test_repo_find_with_created_by() {
    let ctx = TestContext::new().await;
    let user1 = ctx.create_user("u1@example.com").await;
    let user2 = ctx.create_user("u2@example.com").await;

    ctx.movie_repo
        .save(&backend::movie::Movie::new("M1".into(), user1.id.clone()))
        .await
        .unwrap();
    ctx.movie_repo
        .save(&backend::movie::Movie::new("M2".into(), user2.id.clone()))
        .await
        .unwrap();

    let filter = MovieFilter {
        created_by: Some(user1.id.clone()),
        ..Default::default()
    };
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx.movie_repo.find(&opts, &filter).await.unwrap();
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].title, "M1");
}

#[tokio::test]
async fn test_repo_find_pagination() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    for i in 1..=5 {
        ctx.movie_repo
            .save(&backend::movie::Movie::new(
                format!("Movie {i}"),
                user.id.clone(),
            ))
            .await
            .unwrap();
    }

    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 2,
    };
    let page1 = ctx
        .movie_repo
        .find(&opts, &MovieFilter::default())
        .await
        .unwrap();
    assert_eq!(page1.items.len(), 2);
    assert_eq!(page1.pagination.total, 5);
    assert_eq!(page1.pagination.pages, 3);

    let opts = backend::kernel::PaginationOptions {
        page: 3,
        page_size: 2,
    };
    let page3 = ctx
        .movie_repo
        .find(&opts, &MovieFilter::default())
        .await
        .unwrap();
    assert_eq!(page3.items.len(), 1);
}

// ============================================================================
// Service: Create
// ============================================================================

#[tokio::test]
async fn test_service_create_movie() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Inception"), user.id.clone())
        .await
        .unwrap();

    assert_eq!(movie.title, "Inception");
    assert_eq!(movie.description.as_deref(), Some("A great movie"));
    assert_eq!(movie.release_year, Some(2024));
    assert_eq!(movie.director.as_deref(), Some("Spielberg"));
}

#[tokio::test]
async fn test_service_create_movie_user_not_found() {
    let ctx = TestContext::new().await;
    let err = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), UserId::new())
        .await
        .unwrap_err();
    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_create_movie_empty_title() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let err = ctx
        .movie_svc
        .create_movie(ctx.create_req("  "), user.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_create_movie_invalid_year() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let mut req = ctx.create_req("Movie");
    req.release_year = Some(1800);
    let err = ctx
        .movie_svc
        .create_movie(req, user.id.clone())
        .await
        .unwrap_err();
    assert_eq!(err.code, "VALIDATION_ERROR");
}

// ============================================================================
// Service: Get / Find / List
// ============================================================================

#[tokio::test]
async fn test_service_get_movie() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let created = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), user.id.clone())
        .await
        .unwrap();
    let found = ctx.movie_svc.get_movie(&created.id).await.unwrap();
    assert_eq!(found.title, "Movie");
}

#[tokio::test]
async fn test_service_get_movie_not_found() {
    let ctx = TestContext::new().await;
    let err = ctx.movie_svc.get_movie(&MovieId::new()).await.unwrap_err();
    assert_eq!(err.code, "movie.not_found");
}

#[tokio::test]
async fn test_service_find_movies() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    for i in 1..=3 {
        ctx.movie_svc
            .create_movie(ctx.create_req(&format!("Movie {i}")), user.id.clone())
            .await
            .unwrap();
    }
    let opts = backend::kernel::PaginationOptions {
        page: 1,
        page_size: 10,
    };
    let result = ctx
        .movie_svc
        .find_movies(&opts, &MovieFilter::default())
        .await
        .unwrap();
    assert_eq!(result.items.len(), 3);
}

#[tokio::test]
async fn test_service_list_by_user() {
    let ctx = TestContext::new().await;
    let user1 = ctx.create_user("u1@example.com").await;
    let user2 = ctx.create_user("u2@example.com").await;

    ctx.movie_svc
        .create_movie(ctx.create_req("M1"), user1.id.clone())
        .await
        .unwrap();
    ctx.movie_svc
        .create_movie(ctx.create_req("M2"), user1.id.clone())
        .await
        .unwrap();
    ctx.movie_svc
        .create_movie(ctx.create_req("M3"), user2.id.clone())
        .await
        .unwrap();

    let movies = ctx.movie_svc.list_by_user(&user1.id).await.unwrap();
    assert_eq!(movies.len(), 2);
}

// ============================================================================
// Service: Update
// ============================================================================

#[tokio::test]
async fn test_service_update_movie() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Old"), user.id.clone())
        .await
        .unwrap();

    let updated = ctx
        .movie_svc
        .update_movie(
            &movie.id,
            UpdateMovieRequest {
                title: Some("New".into()),
                description: Some("Updated".into()),
                release_year: Some(2025),
                director: Some("Nolan".into()),
            },
            &user.id,
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "New");
    assert_eq!(updated.description.as_deref(), Some("Updated"));
    assert_eq!(updated.release_year, Some(2025));
    assert_eq!(updated.director.as_deref(), Some("Nolan"));
}

#[tokio::test]
async fn test_service_update_movie_partial() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), user.id.clone())
        .await
        .unwrap();

    let updated = ctx
        .movie_svc
        .update_movie(
            &movie.id,
            UpdateMovieRequest {
                title: Some("Changed".into()),
                description: None,
                release_year: None,
                director: None,
            },
            &user.id,
        )
        .await
        .unwrap();

    assert_eq!(updated.title, "Changed");
    assert_eq!(updated.description.as_deref(), Some("A great movie"));
    assert_eq!(updated.release_year, Some(2024));
}

#[tokio::test]
async fn test_service_update_movie_not_found() {
    let ctx = TestContext::new().await;
    let actor = backend::kernel::UserId::new();
    let err = ctx
        .movie_svc
        .update_movie(
            &MovieId::new(),
            UpdateMovieRequest {
                title: Some("X".into()),
                description: None,
                release_year: None,
                director: None,
            },
            &actor,
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "movie.not_found");
}

// ============================================================================
// Service: Delete
// ============================================================================

#[tokio::test]
async fn test_service_delete_movie() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), user.id.clone())
        .await
        .unwrap();
    ctx.movie_svc
        .delete_movie(&movie.id, &user.id)
        .await
        .unwrap();
    let err = ctx.movie_svc.get_movie(&movie.id).await.unwrap_err();
    assert_eq!(err.code, "movie.not_found");
}

#[tokio::test]
async fn test_service_delete_movie_not_found() {
    let ctx = TestContext::new().await;
    let actor = backend::kernel::UserId::new();
    let err = ctx
        .movie_svc
        .delete_movie(&MovieId::new(), &actor)
        .await
        .unwrap_err();
    assert_eq!(err.code, "movie.not_found");
}

// ============================================================================
// Cascade: deleting user cascades movies
// ============================================================================

#[tokio::test]
async fn test_delete_user_cascades_movies() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    ctx.movie_svc
        .create_movie(ctx.create_req("M1"), user.id.clone())
        .await
        .unwrap();
    ctx.movie_svc
        .create_movie(ctx.create_req("M2"), user.id.clone())
        .await
        .unwrap();

    ctx.user_repo.delete(&user.id).await.unwrap();

    let movies = ctx.movie_repo.list_by_user(&user.id).await.unwrap();
    assert_eq!(movies.len(), 0);
}

// ============================================================================
// Service: Membership
// ============================================================================

#[tokio::test]
async fn test_service_create_movie_auto_adds_owner() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;
    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), user.id.clone())
        .await
        .unwrap();
    let members = ctx.movie_svc.list_members(&movie.id).await.unwrap();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0].user_id.as_str(), user.id.as_str());
    assert_eq!(members[0].role, MovieRole::Owner);
}

#[tokio::test]
async fn test_repo_save_with_owner_atomic() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let movie = backend::movie::Movie::new("Atomic".into(), user.id.clone());
    let owner = backend::movie::MovieMember {
        movie_id: movie.id.clone(),
        user_id: user.id.clone(),
        role: MovieRole::Owner,
        joined_at: movie.created_at,
    };
    ctx.movie_repo
        .save_with_owner(&movie, &owner)
        .await
        .unwrap();

    assert!(ctx.movie_repo.get_by_id(&movie.id).await.unwrap().is_some());
    let members = ctx.movie_repo.list_members(&movie.id).await.unwrap();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0].role, MovieRole::Owner);
}

#[tokio::test]
async fn test_repo_save_with_owner_rolls_back_on_member_failure() {
    let ctx = TestContext::new().await;
    let user = ctx.create_user("user@example.com").await;

    let movie = backend::movie::Movie::new("Rollback".into(), user.id.clone());
    // Nonexistent user -> FK violation on the member insert, inside the tx.
    let bad_owner = backend::movie::MovieMember {
        movie_id: movie.id.clone(),
        user_id: UserId::new(),
        role: MovieRole::Owner,
        joined_at: movie.created_at,
    };
    let result = ctx.movie_repo.save_with_owner(&movie, &bad_owner).await;
    assert!(result.is_err());

    // The movie insert must have been rolled back too — no orphan movie.
    assert!(ctx.movie_repo.get_by_id(&movie.id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_service_add_member() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;
    let other = ctx.create_user("other@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), owner.id.clone())
        .await
        .unwrap();

    let member = ctx
        .movie_svc
        .add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: other.id.clone(),
                role: Some("SUPERVISOR".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();
    assert_eq!(member.role, MovieRole::Supervisor);

    let members = ctx.movie_svc.list_members(&movie.id).await.unwrap();
    assert_eq!(members.len(), 2);
}

#[tokio::test]
async fn test_service_add_member_default_role() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;
    let other = ctx.create_user("other@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), owner.id.clone())
        .await
        .unwrap();

    let member = ctx
        .movie_svc
        .add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: other.id.clone(),
                role: None,
            },
            &owner.id,
        )
        .await
        .unwrap();
    assert_eq!(member.role, MovieRole::Viewer);
}

#[tokio::test]
async fn test_service_add_member_duplicate() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), owner.id.clone())
        .await
        .unwrap();

    let err = ctx
        .movie_svc
        .add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: owner.id.clone(),
                role: None,
            },
            &owner.id,
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "movie.member_already_added");
}

#[tokio::test]
async fn test_service_remove_member() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;
    let other = ctx.create_user("other@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), owner.id.clone())
        .await
        .unwrap();

    ctx.movie_svc
        .add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: other.id.clone(),
                role: None,
            },
            &owner.id,
        )
        .await
        .unwrap();

    ctx.movie_svc
        .remove_member(&movie.id, &other.id, &owner.id)
        .await
        .unwrap();

    let members = ctx.movie_svc.list_members(&movie.id).await.unwrap();
    assert_eq!(members.len(), 1); // Only owner remains
}

#[tokio::test]
async fn test_service_get_user_movies() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;
    let collaborator = ctx.create_user("collab@example.com").await;

    let m1 = ctx
        .movie_svc
        .create_movie(ctx.create_req("M1"), owner.id.clone())
        .await
        .unwrap();
    ctx.movie_svc
        .create_movie(ctx.create_req("M2"), owner.id.clone())
        .await
        .unwrap();

    // Add collaborator to M1 only
    ctx.movie_svc
        .add_member(
            &m1.id,
            AddMovieMemberRequest {
                user_id: collaborator.id.clone(),
                role: Some("EDITOR".into()),
            },
            &owner.id,
        )
        .await
        .unwrap();

    let owner_movies = ctx.movie_svc.get_user_movies(&owner.id).await.unwrap();
    assert_eq!(owner_movies.len(), 2);

    let collab_movies = ctx
        .movie_svc
        .get_user_movies(&collaborator.id)
        .await
        .unwrap();
    assert_eq!(collab_movies.len(), 1);
    assert_eq!(collab_movies[0].title, "M1");
}

#[tokio::test]
async fn test_delete_movie_cascades_members() {
    let ctx = TestContext::new().await;
    let owner = ctx.create_user("owner@example.com").await;
    let other = ctx.create_user("other@example.com").await;

    let movie = ctx
        .movie_svc
        .create_movie(ctx.create_req("Movie"), owner.id.clone())
        .await
        .unwrap();

    ctx.movie_svc
        .add_member(
            &movie.id,
            AddMovieMemberRequest {
                user_id: other.id.clone(),
                role: None,
            },
            &owner.id,
        )
        .await
        .unwrap();

    ctx.movie_repo.delete(&movie.id).await.unwrap();

    // Collaborator should see no movies
    let movies = ctx.movie_svc.get_user_movies(&other.id).await.unwrap();
    assert_eq!(movies.len(), 0);
}
