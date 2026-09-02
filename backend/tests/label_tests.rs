mod common;

use std::sync::Arc;

use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{PasswordService, User, UserRepository};
use backend::kernel::LabelId;
use backend::label::adapters::PostgresLabelRepository;
use backend::label::{
    AddMemberRequest, CreateLabelRequest, LabelRepository, LabelRole, LabelService,
    UpdateLabelRequest,
};

use common::TestDb;

struct TestContext {
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
        let password_svc = Arc::new(BcryptPasswordService::new());
        let label_svc = LabelService::new(label_repo.clone(), user_repo.clone());

        Self {
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
}

// ============================================================================
// Repository: Label CRUD
// ============================================================================

#[tokio::test]
async fn test_repo_save_and_get_by_id() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new(
        "Sony Music".into(),
        Some("https://sony.com".into()),
        Some("contact@sony.com".into()),
    );
    ctx.label_repo.save(&label).await.unwrap();

    let found = ctx.label_repo.get_by_id(&label.id).await.unwrap().unwrap();
    assert_eq!(found.name, "Sony Music");
    assert_eq!(found.website.as_deref(), Some("https://sony.com"));
    assert_eq!(found.contact_email.as_deref(), Some("contact@sony.com"));
}

#[tokio::test]
async fn test_repo_get_by_name() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("Warner".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();

    let found = ctx.label_repo.get_by_name("Warner").await.unwrap().unwrap();
    assert_eq!(found.id.as_str(), label.id.as_str());
}

#[tokio::test]
async fn test_repo_get_by_id_not_found() {
    let ctx = TestContext::new().await;
    let result = ctx.label_repo.get_by_id(&LabelId::new()).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_repo_list_all() {
    let ctx = TestContext::new().await;
    ctx.label_repo
        .save(&backend::label::Label::new("Alpha".into(), None, None))
        .await
        .unwrap();
    ctx.label_repo
        .save(&backend::label::Label::new("Beta".into(), None, None))
        .await
        .unwrap();

    let labels = ctx.label_repo.list_all().await.unwrap();
    let names: Vec<&str> = labels.iter().map(|l| l.name.as_str()).collect();
    assert!(names.contains(&"Alpha"));
    assert!(names.contains(&"Beta"));
}

#[tokio::test]
async fn test_repo_update() {
    let ctx = TestContext::new().await;
    let mut label = backend::label::Label::new("Old Name".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();

    label.name = "New Name".into();
    label.website = Some("https://new.com".into());
    ctx.label_repo.update(&label).await.unwrap();

    let found = ctx.label_repo.get_by_id(&label.id).await.unwrap().unwrap();
    assert_eq!(found.name, "New Name");
    assert_eq!(found.website.as_deref(), Some("https://new.com"));
}

#[tokio::test]
async fn test_repo_delete() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("ToDelete".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();

    ctx.label_repo.delete(&label.id).await.unwrap();
    assert!(ctx.label_repo.get_by_id(&label.id).await.unwrap().is_none());
}

// ============================================================================
// Repository: Membership
// ============================================================================

#[tokio::test]
async fn test_repo_add_and_list_members() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("Label".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();

    let user1 = ctx.create_user("member1@example.com").await;
    let user2 = ctx.create_user("member2@example.com").await;

    let m1 = backend::label::LabelMember {
        label_id: label.id.clone(),
        user_id: user1.id.clone(),
        role: LabelRole::Owner,
        joined_at: chrono::Utc::now(),
    };
    let m2 = backend::label::LabelMember {
        label_id: label.id.clone(),
        user_id: user2.id.clone(),
        role: LabelRole::Artist,
        joined_at: chrono::Utc::now(),
    };
    ctx.label_repo.add_member(&m1).await.unwrap();
    ctx.label_repo.add_member(&m2).await.unwrap();

    let members = ctx.label_repo.list_members(&label.id).await.unwrap();
    assert_eq!(members.len(), 2);
}

#[tokio::test]
async fn test_repo_get_member() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("Label".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();
    let user = ctx.create_user("getmember@example.com").await;

    let member = backend::label::LabelMember {
        label_id: label.id.clone(),
        user_id: user.id.clone(),
        role: LabelRole::Rep,
        joined_at: chrono::Utc::now(),
    };
    ctx.label_repo.add_member(&member).await.unwrap();

    let found = ctx
        .label_repo
        .get_member(&label.id, &user.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.role, LabelRole::Rep);
}

#[tokio::test]
async fn test_repo_remove_member() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("Label".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();
    let user = ctx.create_user("remove@example.com").await;

    let member = backend::label::LabelMember {
        label_id: label.id.clone(),
        user_id: user.id.clone(),
        role: LabelRole::Rep,
        joined_at: chrono::Utc::now(),
    };
    ctx.label_repo.add_member(&member).await.unwrap();
    ctx.label_repo
        .remove_member(&label.id, &user.id)
        .await
        .unwrap();

    assert!(
        ctx.label_repo
            .get_member(&label.id, &user.id)
            .await
            .unwrap()
            .is_none()
    );
}

#[tokio::test]
async fn test_repo_get_user_labels() {
    let ctx = TestContext::new().await;
    let label1 = backend::label::Label::new("Label A".into(), None, None);
    let label2 = backend::label::Label::new("Label B".into(), None, None);
    ctx.label_repo.save(&label1).await.unwrap();
    ctx.label_repo.save(&label2).await.unwrap();

    let user = ctx.create_user("multilabel@example.com").await;

    for label in [&label1, &label2] {
        ctx.label_repo
            .add_member(&backend::label::LabelMember {
                label_id: label.id.clone(),
                user_id: user.id.clone(),
                role: LabelRole::Artist,
                joined_at: chrono::Utc::now(),
            })
            .await
            .unwrap();
    }

    let labels = ctx.label_repo.get_user_labels(&user.id).await.unwrap();
    assert_eq!(labels.len(), 2);
}

#[tokio::test]
async fn test_repo_delete_label_cascades_members() {
    let ctx = TestContext::new().await;
    let label = backend::label::Label::new("Cascade".into(), None, None);
    ctx.label_repo.save(&label).await.unwrap();
    let user = ctx.create_user("cascade@example.com").await;

    ctx.label_repo
        .add_member(&backend::label::LabelMember {
            label_id: label.id.clone(),
            user_id: user.id.clone(),
            role: LabelRole::Rep,
            joined_at: chrono::Utc::now(),
        })
        .await
        .unwrap();

    ctx.label_repo.delete(&label.id).await.unwrap();

    let labels = ctx.label_repo.get_user_labels(&user.id).await.unwrap();
    assert_eq!(labels.len(), 0);
}

// ============================================================================
// Service: Label CRUD
// ============================================================================

#[tokio::test]
async fn test_service_create_label() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Universal".into(),
            website: Some("https://universal.com".into()),
            contact_email: None,
        })
        .await
        .unwrap();

    assert_eq!(label.name, "Universal");
    assert_eq!(label.website.as_deref(), Some("https://universal.com"));
}

#[tokio::test]
async fn test_service_create_label_duplicate_name() {
    let ctx = TestContext::new().await;

    ctx.label_svc
        .create_label(CreateLabelRequest {
            name: "Dupe".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let err = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Dupe".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap_err();

    assert_eq!(err.code, "label.already_exists");
}

#[tokio::test]
async fn test_service_create_label_short_name() {
    let ctx = TestContext::new().await;

    let err = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "A".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap_err();

    assert_eq!(err.code, "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_service_get_label_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx.label_svc.get_label(&LabelId::new()).await.unwrap_err();
    assert_eq!(err.code, "label.not_found");
}

#[tokio::test]
async fn test_service_update_label() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Old".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let updated = ctx
        .label_svc
        .update_label(
            &label.id,
            UpdateLabelRequest {
                name: Some("New".into()),
                website: Some("https://new.com".into()),
                contact_email: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(updated.name, "New");
    assert_eq!(updated.website.as_deref(), Some("https://new.com"));
}

#[tokio::test]
async fn test_service_update_label_duplicate_name() {
    let ctx = TestContext::new().await;

    ctx.label_svc
        .create_label(CreateLabelRequest {
            name: "Taken".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let other = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Other".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let err = ctx
        .label_svc
        .update_label(
            &other.id,
            UpdateLabelRequest {
                name: Some("Taken".into()),
                website: None,
                contact_email: None,
            },
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "label.already_exists");
}

#[tokio::test]
async fn test_service_delete_label() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Delete Me".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    ctx.label_svc.delete_label(&label.id).await.unwrap();

    let err = ctx.label_svc.get_label(&label.id).await.unwrap_err();
    assert_eq!(err.code, "label.not_found");
}

// ============================================================================
// Service: Membership
// ============================================================================

#[tokio::test]
async fn test_service_add_member() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("artist@example.com").await;

    let member = ctx
        .label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: Some("ARTIST".into()),
            },
        )
        .await
        .unwrap();

    assert_eq!(member.role, LabelRole::Artist);
}

#[tokio::test]
async fn test_service_add_member_default_role() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("rep@example.com").await;

    let member = ctx
        .label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();

    assert_eq!(member.role, LabelRole::Rep);
}

#[tokio::test]
async fn test_service_add_member_duplicate() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("dupe@example.com").await;

    ctx.label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();

    let err = ctx
        .label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: None,
            },
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "label.member_already_added");
}

#[tokio::test]
async fn test_service_add_member_user_not_found() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let err = ctx
        .label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: backend::kernel::UserId::new(),
                role: None,
            },
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "NOT_FOUND");
}

#[tokio::test]
async fn test_service_add_member_label_not_found() {
    let ctx = TestContext::new().await;

    let user = ctx.create_user("orphan@example.com").await;

    let err = ctx
        .label_svc
        .add_member(
            &LabelId::new(),
            AddMemberRequest {
                user_id: user.id.clone(),
                role: None,
            },
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "label.not_found");
}

#[tokio::test]
async fn test_service_remove_member() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("remove@example.com").await;

    ctx.label_svc
        .add_member(
            &label.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();

    ctx.label_svc
        .remove_member(&label.id, &user.id)
        .await
        .unwrap();

    let members = ctx.label_svc.list_members(&label.id).await.unwrap();
    assert_eq!(members.len(), 0);
}

#[tokio::test]
async fn test_service_remove_member_not_found() {
    let ctx = TestContext::new().await;

    let label = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("ghost@example.com").await;

    let err = ctx
        .label_svc
        .remove_member(&label.id, &user.id)
        .await
        .unwrap_err();

    assert_eq!(err.code, "label.member_not_found");
}

#[tokio::test]
async fn test_service_get_user_labels() {
    let ctx = TestContext::new().await;

    let label1 = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label A".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let label2 = ctx
        .label_svc
        .create_label(CreateLabelRequest {
            name: "Label B".into(),
            website: None,
            contact_email: None,
        })
        .await
        .unwrap();

    let user = ctx.create_user("multi@example.com").await;

    ctx.label_svc
        .add_member(
            &label1.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: Some("ARTIST".into()),
            },
        )
        .await
        .unwrap();
    ctx.label_svc
        .add_member(
            &label2.id,
            AddMemberRequest {
                user_id: user.id.clone(),
                role: Some("ARTIST".into()),
            },
        )
        .await
        .unwrap();

    let labels = ctx.label_svc.get_user_labels(&user.id).await.unwrap();
    assert_eq!(labels.len(), 2);
}
