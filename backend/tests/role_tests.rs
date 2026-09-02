mod common;

use std::sync::Arc;

use backend::iam::role::adapters::PostgresRoleRepository;
use backend::iam::role::{CreateRoleRequest, RoleRepository, RoleService, UpdateRoleRequest};
use backend::iam::user::adapters::PostgresUserRepository;
use backend::iam::user::{User, UserRepository};
use backend::kernel::RoleId;

use common::TestDb;

// ============================================================================
// Repository Tests
// ============================================================================

#[tokio::test]
async fn test_save_and_get_role_by_id() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let role = backend::iam::role::Role::new(
        "TestAdmin".into(),
        "Full access".into(),
        vec!["movies:read".into(), "movies:write".into()],
    );
    let role_id = role.id.clone();

    repo.save(&role).await.unwrap();
    let found = repo.get_by_id(&role_id).await.unwrap();

    assert!(found.is_some());
    let found = found.unwrap();
    assert_eq!(found.name, "TestAdmin");
    assert_eq!(found.description, "Full access");
    assert_eq!(found.scopes, vec!["movies:read", "movies:write"]);
}

#[tokio::test]
async fn test_get_role_by_id_not_found() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let result = repo.get_by_id(&RoleId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_get_role_by_name() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let role = backend::iam::role::Role::new(
        "Editor".into(),
        "Can edit".into(),
        vec!["movies:write".into()],
    );
    repo.save(&role).await.unwrap();

    let found = repo.get_by_name("Editor").await.unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "Editor");

    let not_found = repo.get_by_name("Nonexistent").await.unwrap();
    assert!(not_found.is_none());
}

#[tokio::test]
async fn test_list_all_roles() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let r1 = backend::iam::role::Role::new("A-Role".into(), "".into(), vec!["movies:read".into()]);
    let r2 = backend::iam::role::Role::new("B-Role".into(), "".into(), vec!["tracks:read".into()]);
    repo.save(&r1).await.unwrap();
    repo.save(&r2).await.unwrap();

    let roles = repo.list_all().await.unwrap();
    let names: Vec<&str> = roles.iter().map(|r| r.name.as_str()).collect();
    assert!(names.contains(&"A-Role"));
    assert!(names.contains(&"B-Role"));
}

#[tokio::test]
async fn test_update_role_via_save() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let mut role = backend::iam::role::Role::new(
        "Updatable".into(),
        "Before".into(),
        vec!["movies:read".into()],
    );
    repo.save(&role).await.unwrap();

    role.name = "Updated".into();
    role.description = "After".into();
    role.set_scopes(vec!["movies:read".into(), "movies:write".into()]);
    repo.save(&role).await.unwrap();

    let found = repo.get_by_id(&role.id).await.unwrap().unwrap();
    assert_eq!(found.name, "Updated");
    assert_eq!(found.description, "After");
    assert_eq!(found.scopes.len(), 2);
}

#[tokio::test]
async fn test_delete_role() {
    let db = TestDb::new().await;
    let repo = PostgresRoleRepository::new(db.pool.clone());

    let role =
        backend::iam::role::Role::new("Deletable".into(), "".into(), vec!["movies:read".into()]);
    let role_id = role.id.clone();
    repo.save(&role).await.unwrap();

    repo.delete(&role_id).await.unwrap();
    let found = repo.get_by_id(&role_id).await.unwrap();
    assert!(found.is_none());
}

#[tokio::test]
async fn test_assign_and_list_by_user() {
    let db = TestDb::new().await;
    let role_repo = PostgresRoleRepository::new(db.pool.clone());
    let user_repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password("assign@example.com".into(), "Assign".into(), "hash".into());
    user_repo.save(&user).await.unwrap();

    let r1 = backend::iam::role::Role::new("Role-A".into(), "".into(), vec!["movies:read".into()]);
    let r2 = backend::iam::role::Role::new("Role-B".into(), "".into(), vec!["tracks:read".into()]);
    role_repo.save(&r1).await.unwrap();
    role_repo.save(&r2).await.unwrap();

    role_repo.assign_to_user(&user.id, &r1.id).await.unwrap();
    role_repo.assign_to_user(&user.id, &r2.id).await.unwrap();

    let roles = role_repo.list_by_user(&user.id).await.unwrap();
    assert_eq!(roles.len(), 2);
}

#[tokio::test]
async fn test_assign_idempotent() {
    let db = TestDb::new().await;
    let role_repo = PostgresRoleRepository::new(db.pool.clone());
    let user_repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password("idem@example.com".into(), "Idem".into(), "hash".into());
    user_repo.save(&user).await.unwrap();

    let role =
        backend::iam::role::Role::new("Unique".into(), "".into(), vec!["movies:read".into()]);
    role_repo.save(&role).await.unwrap();

    // Assign twice — should not fail
    role_repo.assign_to_user(&user.id, &role.id).await.unwrap();
    role_repo.assign_to_user(&user.id, &role.id).await.unwrap();

    let roles = role_repo.list_by_user(&user.id).await.unwrap();
    assert_eq!(roles.len(), 1);
}

#[tokio::test]
async fn test_unassign_from_user() {
    let db = TestDb::new().await;
    let role_repo = PostgresRoleRepository::new(db.pool.clone());
    let user_repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password(
        "unassign@example.com".into(),
        "Unassign".into(),
        "hash".into(),
    );
    user_repo.save(&user).await.unwrap();

    let role =
        backend::iam::role::Role::new("Removable".into(), "".into(), vec!["movies:read".into()]);
    role_repo.save(&role).await.unwrap();
    role_repo.assign_to_user(&user.id, &role.id).await.unwrap();

    role_repo
        .unassign_from_user(&user.id, &role.id)
        .await
        .unwrap();
    let roles = role_repo.list_by_user(&user.id).await.unwrap();
    assert!(roles.is_empty());
}

#[tokio::test]
async fn test_delete_role_cascades_assignments() {
    let db = TestDb::new().await;
    let role_repo = PostgresRoleRepository::new(db.pool.clone());
    let user_repo = PostgresUserRepository::new(db.pool.clone());

    let user = User::new_with_password(
        "cascade@example.com".into(),
        "Cascade".into(),
        "hash".into(),
    );
    user_repo.save(&user).await.unwrap();

    let role =
        backend::iam::role::Role::new("CascadeRole".into(), "".into(), vec!["movies:read".into()]);
    let role_id = role.id.clone();
    role_repo.save(&role).await.unwrap();
    role_repo.assign_to_user(&user.id, &role_id).await.unwrap();

    role_repo.delete(&role_id).await.unwrap();
    let roles = role_repo.list_by_user(&user.id).await.unwrap();
    assert!(roles.is_empty());
}

// ============================================================================
// Service Tests
// ============================================================================

#[tokio::test]
async fn test_service_create_role() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let req = CreateRoleRequest {
        name: "TestViewer".into(),
        description: Some("Read-only access".into()),
        scopes: vec!["movies:read".into(), "tracks:read".into()],
    };

    let response = svc.create_role(req).await.unwrap();
    assert_eq!(response.name, "TestViewer");
    assert_eq!(response.scopes, vec!["movies:read", "tracks:read"]);
}

#[tokio::test]
async fn test_service_create_role_duplicate_name() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let req = CreateRoleRequest {
        name: "Duplicate".into(),
        description: None,
        scopes: vec!["movies:read".into()],
    };
    svc.create_role(req).await.unwrap();

    let req2 = CreateRoleRequest {
        name: "Duplicate".into(),
        description: None,
        scopes: vec!["tracks:read".into()],
    };
    let err = svc.create_role(req2).await.unwrap_err();
    assert_eq!(err.code, "role.already_exists");
}

#[tokio::test]
async fn test_service_create_role_invalid_scopes() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let req = CreateRoleRequest {
        name: "BadScopes".into(),
        description: None,
        scopes: vec!["totally:invalid".into()],
    };
    let err = svc.create_role(req).await.unwrap_err();
    assert_eq!(err.code, "role.invalid_scopes");
}

#[tokio::test]
async fn test_service_get_role_not_found() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let err = svc.get_role(&RoleId::new()).await.unwrap_err();
    assert_eq!(err.code, "role.not_found");
}

#[tokio::test]
async fn test_service_update_role() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let req = CreateRoleRequest {
        name: "Before".into(),
        description: None,
        scopes: vec!["movies:read".into()],
    };
    let created = svc.create_role(req).await.unwrap();

    let update = UpdateRoleRequest {
        name: Some("After".into()),
        description: Some("Updated desc".into()),
        scopes: Some(vec!["movies:read".into(), "movies:write".into()]),
    };
    let updated = svc.update_role(&created.id, update).await.unwrap();
    assert_eq!(updated.name, "After");
    assert_eq!(updated.description, "Updated desc");
    assert_eq!(updated.scopes.len(), 2);
}

#[tokio::test]
async fn test_service_delete_role() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let req = CreateRoleRequest {
        name: "Deletable".into(),
        description: None,
        scopes: vec!["movies:read".into()],
    };
    let created = svc.create_role(req).await.unwrap();

    svc.delete_role(&created.id).await.unwrap();
    let err = svc.get_role(&created.id).await.unwrap_err();
    assert_eq!(err.code, "role.not_found");
}

#[tokio::test]
async fn test_service_assign_role_and_get_user_roles() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo.clone());

    let user =
        User::new_with_password("roles@example.com".into(), "RoleUser".into(), "hash".into());
    user_repo.save(&user).await.unwrap();

    let r1 = svc
        .create_role(CreateRoleRequest {
            name: "R1".into(),
            description: None,
            scopes: vec!["movies:read".into()],
        })
        .await
        .unwrap();

    let r2 = svc
        .create_role(CreateRoleRequest {
            name: "R2".into(),
            description: None,
            scopes: vec!["tracks:read".into(), "movies:read".into()],
        })
        .await
        .unwrap();

    svc.assign_role_to_user(&r1.id, &user.id).await.unwrap();
    svc.assign_role_to_user(&r2.id, &user.id).await.unwrap();

    let user_roles = svc.get_user_roles(&user.id).await.unwrap();
    assert_eq!(user_roles.roles.len(), 2);
    // Effective scopes should be deduplicated
    assert!(
        user_roles
            .effective_scopes
            .contains(&"movies:read".to_string())
    );
    assert!(
        user_roles
            .effective_scopes
            .contains(&"tracks:read".to_string())
    );
    // "movies:read" appears in both roles but should only show once
    assert_eq!(
        user_roles
            .effective_scopes
            .iter()
            .filter(|s| *s == "movies:read")
            .count(),
        1
    );
}

#[tokio::test]
async fn test_service_assign_role_user_not_found() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo);

    let role = svc
        .create_role(CreateRoleRequest {
            name: "Ghost".into(),
            description: None,
            scopes: vec!["movies:read".into()],
        })
        .await
        .unwrap();

    let err = svc
        .assign_role_to_user(&role.id, &backend::kernel::UserId::new())
        .await
        .unwrap_err();
    assert_eq!(err.code, "user.not_found");
}

#[tokio::test]
async fn test_service_unassign_role() {
    let db = TestDb::new().await;
    let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
    let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
    let svc = RoleService::new(role_repo, user_repo.clone());

    let user = User::new_with_password("unsvc@example.com".into(), "Unsvc".into(), "hash".into());
    user_repo.save(&user).await.unwrap();

    let role = svc
        .create_role(CreateRoleRequest {
            name: "Temp".into(),
            description: None,
            scopes: vec!["movies:read".into()],
        })
        .await
        .unwrap();

    svc.assign_role_to_user(&role.id, &user.id).await.unwrap();
    svc.unassign_role_from_user(&role.id, &user.id)
        .await
        .unwrap();

    let user_roles = svc.get_user_roles(&user.id).await.unwrap();
    assert!(user_roles.roles.is_empty());
    assert!(user_roles.effective_scopes.is_empty());
}
