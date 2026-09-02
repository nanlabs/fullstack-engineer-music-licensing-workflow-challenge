use std::sync::Arc;

use chrono::Utc;

use crate::error::AppError;
use crate::iam::user::{UserRepository, UserRepositoryExt};
use crate::kernel::{LabelId, UserId};

use super::error::LabelError;
use super::model::{
    AddMemberRequest, CreateLabelRequest, Label, LabelMember, LabelMemberWithDetails, LabelRole,
    UpdateLabelRequest,
};
use super::port::LabelRepository;

pub struct LabelService {
    label_repo: Arc<dyn LabelRepository>,
    user_repo: Arc<dyn UserRepository>,
}

impl LabelService {
    pub fn new(label_repo: Arc<dyn LabelRepository>, user_repo: Arc<dyn UserRepository>) -> Self {
        Self {
            label_repo,
            user_repo,
        }
    }

    // ========================================================================
    // Label CRUD
    // ========================================================================

    pub async fn create_label(&self, req: CreateLabelRequest) -> Result<Label, AppError> {
        req.validate()?;

        if self.label_repo.get_by_name(&req.name).await?.is_some() {
            return Err(LabelError::already_exists());
        }

        let label = Label::new(req.name, req.website, req.contact_email);
        self.label_repo.save(&label).await?;
        Ok(label)
    }

    pub async fn get_label(&self, id: &LabelId) -> Result<Label, AppError> {
        self.label_repo
            .get_by_id(id)
            .await?
            .ok_or_else(LabelError::not_found)
    }

    pub async fn list_labels(&self) -> Result<Vec<Label>, AppError> {
        self.label_repo.list_all().await
    }

    pub async fn update_label(
        &self,
        id: &LabelId,
        req: UpdateLabelRequest,
    ) -> Result<Label, AppError> {
        req.validate()?;

        let mut label = self.get_label(id).await?;

        // Check name uniqueness if changing
        if let Some(ref name) = req.name
            && name != &label.name
            && self.label_repo.get_by_name(name).await?.is_some()
        {
            return Err(LabelError::already_exists());
        }

        if let Some(name) = req.name {
            label.name = name;
        }
        if let Some(website) = req.website {
            label.website = Some(website);
        }
        if let Some(contact_email) = req.contact_email {
            label.contact_email = Some(contact_email);
        }
        label.updated_at = Utc::now();

        self.label_repo.update(&label).await?;
        Ok(label)
    }

    pub async fn delete_label(&self, id: &LabelId) -> Result<(), AppError> {
        self.get_label(id).await?;
        self.label_repo.delete(id).await
    }

    // ========================================================================
    // Membership
    // ========================================================================

    pub async fn add_member(
        &self,
        label_id: &LabelId,
        req: AddMemberRequest,
    ) -> Result<LabelMember, AppError> {
        // Verify label exists
        self.get_label(label_id).await?;

        // Verify user exists
        self.user_repo
            .get_by_id(&req.user_id)
            .await?
            .ok_or_else(|| AppError::not_found("User not found"))?;

        // Check not already a member
        if self
            .label_repo
            .get_member(label_id, &req.user_id)
            .await?
            .is_some()
        {
            return Err(LabelError::member_already_added());
        }

        let role = match req.role.as_deref() {
            Some(r) => LabelRole::try_from(r)?,
            None => LabelRole::Rep,
        };

        let member = LabelMember {
            label_id: label_id.clone(),
            user_id: req.user_id,
            role,
            joined_at: Utc::now(),
        };

        self.label_repo.add_member(&member).await?;
        Ok(member)
    }

    pub async fn remove_member(
        &self,
        label_id: &LabelId,
        user_id: &UserId,
    ) -> Result<(), AppError> {
        self.label_repo
            .get_member(label_id, user_id)
            .await?
            .ok_or_else(LabelError::member_not_found)?;

        self.label_repo.remove_member(label_id, user_id).await
    }

    pub async fn list_members(&self, label_id: &LabelId) -> Result<Vec<LabelMember>, AppError> {
        self.get_label(label_id).await?;
        self.label_repo.list_members(label_id).await
    }

    pub async fn get_user_labels(&self, user_id: &UserId) -> Result<Vec<Label>, AppError> {
        self.label_repo.get_user_labels(user_id).await
    }

    pub async fn to_member_details(
        &self,
        members: &[LabelMember],
    ) -> Result<Vec<LabelMemberWithDetails>, AppError> {
        let names = self
            .user_repo
            .resolve_names(members.iter().map(|m| m.user_id.clone()))
            .await?;
        Ok(members
            .iter()
            .cloned()
            .map(|m| {
                let user_name = names.get(&m.user_id).cloned();
                LabelMemberWithDetails {
                    member: m,
                    user_name,
                }
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iam::user::model::UserFilter;
    use crate::iam::user::{User, UserRepository};
    use crate::kernel::{Paginated, PaginationOptions};
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

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
        async fn get_by_name(&self, name: &str) -> Result<Option<Label>, AppError> {
            Ok(self
                .labels
                .lock()
                .await
                .iter()
                .find(|l| l.name == name)
                .cloned())
        }
        async fn list_all(&self) -> Result<Vec<Label>, AppError> {
            Ok(self.labels.lock().await.clone())
        }
        async fn update(&self, label: &Label) -> Result<(), AppError> {
            let mut labels = self.labels.lock().await;
            if let Some(l) = labels.iter_mut().find(|l| l.id == label.id) {
                *l = label.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &LabelId) -> Result<(), AppError> {
            self.labels.lock().await.retain(|l| l.id != *id);
            Ok(())
        }
        async fn add_member(&self, member: &LabelMember) -> Result<(), AppError> {
            self.members.lock().await.push(member.clone());
            Ok(())
        }
        async fn remove_member(
            &self,
            label_id: &LabelId,
            user_id: &UserId,
        ) -> Result<(), AppError> {
            self.members
                .lock()
                .await
                .retain(|m| !(m.label_id == *label_id && m.user_id == *user_id));
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
        async fn list_members(&self, label_id: &LabelId) -> Result<Vec<LabelMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .filter(|m| m.label_id == *label_id)
                .cloned()
                .collect())
        }
        async fn get_user_labels(&self, user_id: &UserId) -> Result<Vec<Label>, AppError> {
            let members = self.members.lock().await;
            let label_ids: Vec<LabelId> = members
                .iter()
                .filter(|m| m.user_id == *user_id)
                .map(|m| m.label_id.clone())
                .collect();
            let labels = self.labels.lock().await;
            Ok(labels
                .iter()
                .filter(|l| label_ids.contains(&l.id))
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

    fn make_svc(label_repo: MockLabelRepo, user_repo: MockUserRepo) -> LabelService {
        LabelService::new(Arc::new(label_repo), Arc::new(user_repo))
    }

    fn create_req(name: &str) -> CreateLabelRequest {
        CreateLabelRequest {
            name: name.into(),
            website: None,
            contact_email: None,
        }
    }

    fn make_user() -> User {
        User::new_with_password("test@example.com".into(), "Test".into(), "hash".into())
    }

    // ========================================================================
    // create_label
    // ========================================================================

    #[tokio::test]
    async fn create_label_success() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        assert_eq!(label.name, "Sony");
    }

    #[tokio::test]
    async fn create_label_duplicate() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        svc.create_label(create_req("Sony")).await.unwrap();
        let err = svc.create_label(create_req("Sony")).await.unwrap_err();
        assert_eq!(err.code, "label.already_exists");
    }

    #[tokio::test]
    async fn create_label_short_name() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let err = svc.create_label(create_req("A")).await.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_label / list_labels
    // ========================================================================

    #[tokio::test]
    async fn get_label_success() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let created = svc.create_label(create_req("Sony")).await.unwrap();
        let found = svc.get_label(&created.id).await.unwrap();
        assert_eq!(found.name, "Sony");
    }

    #[tokio::test]
    async fn get_label_not_found() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let err = svc.get_label(&LabelId::new()).await.unwrap_err();
        assert_eq!(err.code, "label.not_found");
    }

    #[tokio::test]
    async fn list_labels_returns_all() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        svc.create_label(create_req("Sony")).await.unwrap();
        svc.create_label(create_req("Warner")).await.unwrap();
        let labels = svc.list_labels().await.unwrap();
        assert_eq!(labels.len(), 2);
    }

    // ========================================================================
    // update_label
    // ========================================================================

    #[tokio::test]
    async fn update_label_success() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let created = svc.create_label(create_req("Old")).await.unwrap();
        let updated = svc
            .update_label(
                &created.id,
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
    async fn update_label_not_found() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let err = svc
            .update_label(
                &LabelId::new(),
                UpdateLabelRequest {
                    name: Some("Test".into()),
                    website: None,
                    contact_email: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "label.not_found");
    }

    #[tokio::test]
    async fn update_label_duplicate_name() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        svc.create_label(create_req("Taken")).await.unwrap();
        let other = svc.create_label(create_req("Other")).await.unwrap();
        let err = svc
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

    // ========================================================================
    // delete_label
    // ========================================================================

    #[tokio::test]
    async fn delete_label_success() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let created = svc.create_label(create_req("Sony")).await.unwrap();
        svc.delete_label(&created.id).await.unwrap();
        let err = svc.get_label(&created.id).await.unwrap_err();
        assert_eq!(err.code, "label.not_found");
    }

    #[tokio::test]
    async fn delete_label_not_found() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let err = svc.delete_label(&LabelId::new()).await.unwrap_err();
        assert_eq!(err.code, "label.not_found");
    }

    // ========================================================================
    // Membership
    // ========================================================================

    #[tokio::test]
    async fn add_member_success() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        let member = svc
            .add_member(
                &label.id,
                AddMemberRequest {
                    user_id: user_id.clone(),
                    role: Some("ARTIST".into()),
                },
            )
            .await
            .unwrap();
        assert_eq!(member.role, LabelRole::Artist);
    }

    #[tokio::test]
    async fn add_member_default_role() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        let member = svc
            .add_member(
                &label.id,
                AddMemberRequest {
                    user_id: user_id.clone(),
                    role: None,
                },
            )
            .await
            .unwrap();
        assert_eq!(member.role, LabelRole::Rep);
    }

    #[tokio::test]
    async fn add_member_label_not_found() {
        let user = make_user();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user.clone()));
        let err = svc
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
    async fn add_member_user_not_found() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        let err = svc
            .add_member(
                &label.id,
                AddMemberRequest {
                    user_id: UserId::new(),
                    role: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn add_member_duplicate() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        svc.add_member(
            &label.id,
            AddMemberRequest {
                user_id: user_id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();
        let err = svc
            .add_member(
                &label.id,
                AddMemberRequest {
                    user_id: user_id.clone(),
                    role: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "label.member_already_added");
    }

    #[tokio::test]
    async fn remove_member_success() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        svc.add_member(
            &label.id,
            AddMemberRequest {
                user_id: user_id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();
        svc.remove_member(&label.id, &user_id).await.unwrap();
    }

    #[tokio::test]
    async fn remove_member_not_found() {
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::new());
        let err = svc
            .remove_member(&LabelId::new(), &UserId::new())
            .await
            .unwrap_err();
        assert_eq!(err.code, "label.member_not_found");
    }

    #[tokio::test]
    async fn list_members_success() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let label = svc.create_label(create_req("Sony")).await.unwrap();
        svc.add_member(
            &label.id,
            AddMemberRequest {
                user_id: user_id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();
        let members = svc.list_members(&label.id).await.unwrap();
        assert_eq!(members.len(), 1);
    }

    #[tokio::test]
    async fn get_user_labels_success() {
        let user = make_user();
        let user_id = user.id.clone();
        let svc = make_svc(MockLabelRepo::new(), MockUserRepo::with_user(user));
        let l1 = svc.create_label(create_req("Sony")).await.unwrap();
        let l2 = svc.create_label(create_req("Warner")).await.unwrap();
        svc.add_member(
            &l1.id,
            AddMemberRequest {
                user_id: user_id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();
        svc.add_member(
            &l2.id,
            AddMemberRequest {
                user_id: user_id.clone(),
                role: None,
            },
        )
        .await
        .unwrap();
        let labels = svc.get_user_labels(&user_id).await.unwrap();
        assert_eq!(labels.len(), 2);
    }
}
