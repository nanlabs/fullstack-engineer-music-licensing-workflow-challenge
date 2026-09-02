mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::model::UserFilter;
use backend::iam::user::{
    CreateUserRequest, OAuthProvider, UpdateUserRequest, User, UserRepository, UserService,
    UserStatus,
};
use backend::kernel::{PaginationOptions, UserId};

use common::TestDb;

// ============================================================================
// Repository Tests
// ============================================================================

#[tokio::test]
async fn test_save_and_get_by_id() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password(
        "test@example.com".into(),
        "Test User".into(),
        "hashed_pw".into(),
    );
    let user_id = user.id.clone();

    repo.save(&user).await.unwrap();
    let found = repo.get_by_id(&user_id).await.unwrap();

    assert!(found.is_some());
    let found = found.unwrap();
    assert_eq!(found.email, "test@example.com");
    assert_eq!(found.name, "Test User");
    assert_eq!(found.status, UserStatus::Pending);
    assert!(found.has_password());
    assert!(!found.has_oauth());
}

#[tokio::test]
async fn test_save_oauth_user() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_oauth(
        "oauth@example.com".into(),
        "OAuth User".into(),
        Some("https://example.com/pic.jpg".into()),
        OAuthProvider::Google,
        "google-id-123".into(),
    );
    let user_id = user.id.clone();

    repo.save(&user).await.unwrap();
    let found = repo.get_by_id(&user_id).await.unwrap().unwrap();

    assert_eq!(found.email, "oauth@example.com");
    assert_eq!(found.oauth_provider, Some(OAuthProvider::Google));
    assert_eq!(found.oauth_provider_id.as_deref(), Some("google-id-123"));
    assert!(!found.has_password());
    assert!(found.has_oauth());
    assert_eq!(found.status, UserStatus::Active);
    assert!(found.email_verified);
}

#[tokio::test]
async fn test_get_by_id_not_found() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let result = repo.get_by_id(&UserId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_get_by_email() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let user =
        User::new_with_password("find@example.com".into(), "Find Me".into(), "hashed".into());
    repo.save(&user).await.unwrap();

    let found = repo.get_by_email("find@example.com").await.unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "Find Me");

    let not_found = repo.get_by_email("nope@example.com").await.unwrap();
    assert!(not_found.is_none());
}

#[tokio::test]
async fn test_update_user() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let mut user = User::new_with_password(
        "update@example.com".into(),
        "Before".into(),
        "hashed".into(),
    );
    repo.save(&user).await.unwrap();

    user.name = "After".into();
    user.link_oauth(OAuthProvider::Microsoft, "ms-id-456".into());
    repo.update(&user).await.unwrap();

    let found = repo.get_by_id(&user.id).await.unwrap().unwrap();
    assert_eq!(found.name, "After");
    assert_eq!(found.oauth_provider, Some(OAuthProvider::Microsoft));
    assert!(found.has_password());
    assert!(found.has_oauth());
}

#[tokio::test]
async fn test_delete_user() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password(
        "delete@example.com".into(),
        "Delete Me".into(),
        "hashed".into(),
    );
    let user_id = user.id.clone();
    repo.save(&user).await.unwrap();

    repo.delete(&user_id).await.unwrap();
    let found = repo.get_by_id(&user_id).await.unwrap();
    assert!(found.is_none());
}

#[tokio::test]
async fn test_find_with_pagination() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    for i in 0..5 {
        let user = User::new_with_password(
            format!("page{i}@example.com"),
            format!("User {i}"),
            "hashed".into(),
        );
        repo.save(&user).await.unwrap();
    }

    let opts = PaginationOptions {
        page: 1,
        page_size: 2,
    };
    let filter = UserFilter::default();
    let page = repo.find(&opts, &filter).await.unwrap();

    // 5 created + 6 seeded = 11
    assert_eq!(page.items.len(), 2);
    assert!(page.pagination.total >= 5);
    assert!(page.has_next());
}

#[tokio::test]
async fn test_find_with_search_filter() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let user1 = User::new_with_password("alice@example.com".into(), "Alice".into(), "h".into());
    let user2 = User::new_with_password("bob@example.com".into(), "Bob".into(), "h".into());
    repo.save(&user1).await.unwrap();
    repo.save(&user2).await.unwrap();

    let opts = PaginationOptions::default();
    let filter = UserFilter {
        search: Some("%alice%".into()),
        status: None,
    };
    let page = repo.find(&opts, &filter).await.unwrap();

    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].name, "Alice");
}

#[tokio::test]
async fn test_find_with_status_filter() {
    let db = TestDb::new().await;
    let repo = PostgresUserRepository::new(db.pool.clone());

    let pending = User::new_with_password("p@example.com".into(), "Pending".into(), "h".into());
    let active = User::new_with_oauth(
        "a@example.com".into(),
        "Active".into(),
        None,
        OAuthProvider::Google,
        "gid".into(),
    );
    repo.save(&pending).await.unwrap();
    repo.save(&active).await.unwrap();

    let opts = PaginationOptions::default();
    let filter = UserFilter {
        search: None,
        status: Some(UserStatus::Active),
    };
    let page = repo.find(&opts, &filter).await.unwrap();

    // Seeded users are also Active, so just verify our created one is included
    let names: Vec<&str> = page.items.iter().map(|u| u.name.as_str()).collect();
    assert!(names.contains(&"Active"));
}

// ============================================================================
// Service Tests
// ============================================================================

#[tokio::test]
async fn test_service_create_user() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let req = CreateUserRequest {
        email: "svc@example.com".into(),
        name: "Service User".into(),
        password: "strong_password_123".into(),
    };

    let response = svc.create_user(req).await.unwrap();
    assert_eq!(response.email, "svc@example.com");
    assert_eq!(response.name, "Service User");
    assert!(response.has_password);
}

#[tokio::test]
async fn test_service_create_user_duplicate_email() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let req = CreateUserRequest {
        email: "dup@example.com".into(),
        name: "First".into(),
        password: "password123".into(),
    };
    svc.create_user(req).await.unwrap();

    let req2 = CreateUserRequest {
        email: "dup@example.com".into(),
        name: "Second".into(),
        password: "password456".into(),
    };
    let err = svc.create_user(req2).await.unwrap_err();
    assert_eq!(err.code, "user.already_exists");
}

#[tokio::test]
async fn test_service_get_user_not_found() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let err = svc.get_user(&UserId::new()).await.unwrap_err();
    assert_eq!(err.code, "user.not_found");
}

#[tokio::test]
async fn test_service_update_user() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let req = CreateUserRequest {
        email: "upd@example.com".into(),
        name: "Before".into(),
        password: "password123".into(),
    };
    let created = svc.create_user(req).await.unwrap();

    let update_req = UpdateUserRequest {
        name: Some("After".into()),
        status: None,
    };
    let updated = svc.update_user(&created.id, update_req).await.unwrap();
    assert_eq!(updated.name, "After");
}

#[tokio::test]
async fn test_service_activate_and_suspend() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let req = CreateUserRequest {
        email: "status@example.com".into(),
        name: "Status".into(),
        password: "password123".into(),
    };
    let created = svc.create_user(req).await.unwrap();
    assert_eq!(created.status, UserStatus::Pending);

    let activated = svc.activate_user(&created.id).await.unwrap();
    assert_eq!(activated.status, UserStatus::Active);

    let suspended = svc.suspend_user(&created.id, "test reason").await.unwrap();
    assert_eq!(suspended.status, UserStatus::Suspended);
}

#[tokio::test]
async fn test_service_delete_user() {
    let db = TestDb::new().await;
    let repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let password_svc = Arc::new(BcryptPasswordService::new());
    let svc = UserService::new(repo, password_svc);

    let req = CreateUserRequest {
        email: "del@example.com".into(),
        name: "Delete".into(),
        password: "password123".into(),
    };
    let created = svc.create_user(req).await.unwrap();

    svc.delete_user(&created.id).await.unwrap();
    let err = svc.get_user(&created.id).await.unwrap_err();
    assert_eq!(err.code, "user.not_found");
}
