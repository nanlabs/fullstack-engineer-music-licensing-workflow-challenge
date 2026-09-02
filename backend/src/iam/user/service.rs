use std::sync::Arc;

use crate::error::AppError;
use crate::kernel::{Paginated, PaginationOptions, UserId};

use super::model::UserFilter;
use super::{
    CreateUserRequest, PasswordService, UpdateUserRequest, User, UserError, UserRepository,
    UserResponse,
};

pub struct UserService {
    repo: Arc<dyn UserRepository>,
    password_svc: Arc<dyn PasswordService>,
}

impl UserService {
    pub fn new(repo: Arc<dyn UserRepository>, password_svc: Arc<dyn PasswordService>) -> Self {
        Self { repo, password_svc }
    }

    pub async fn create_user(&self, req: CreateUserRequest) -> Result<UserResponse, AppError> {
        req.validate()?;

        if self.repo.get_by_email(&req.email).await?.is_some() {
            return Err(UserError::already_exists());
        }

        let password_hash = self.password_svc.hash_password(&req.password)?;
        let user = User::new_with_password(req.email, req.name, password_hash);
        self.repo.save(&user).await?;

        Ok(user.into())
    }

    pub async fn get_user(&self, id: &UserId) -> Result<UserResponse, AppError> {
        let user = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(UserError::not_found)?;
        Ok(user.into())
    }

    pub async fn get_user_by_email(&self, email: &str) -> Result<UserResponse, AppError> {
        let user = self
            .repo
            .get_by_email(email)
            .await?
            .ok_or_else(UserError::not_found)?;
        Ok(user.into())
    }

    pub async fn find_users(
        &self,
        opts: &PaginationOptions,
        filter: &UserFilter,
    ) -> Result<Paginated<UserResponse>, AppError> {
        let page = self.repo.find(opts, filter).await?;
        let responses = page.items.into_iter().map(UserResponse::from).collect();
        Ok(Paginated::new(
            responses,
            page.pagination.page,
            page.pagination.page_size,
            page.pagination.total,
        ))
    }

    pub async fn update_user(
        &self,
        id: &UserId,
        req: UpdateUserRequest,
    ) -> Result<UserResponse, AppError> {
        req.validate()?;

        let mut user = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(UserError::not_found)?;

        if let Some(name) = req.name {
            user.update_profile(Some(name), None);
        }

        if let Some(status) = req.status {
            match status {
                super::UserStatus::Active => user.activate()?,
                super::UserStatus::Suspended => user.suspend("Updated by admin")?,
                _ => return Err(UserError::invalid_status()),
            }
        }

        self.repo.update(&user).await?;
        Ok(user.into())
    }

    pub async fn activate_user(&self, id: &UserId) -> Result<UserResponse, AppError> {
        let mut user = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(UserError::not_found)?;
        user.activate()?;
        self.repo.update(&user).await?;
        Ok(user.into())
    }

    pub async fn suspend_user(&self, id: &UserId, reason: &str) -> Result<UserResponse, AppError> {
        let mut user = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(UserError::not_found)?;
        user.suspend(reason)?;
        self.repo.update(&user).await?;
        Ok(user.into())
    }

    pub async fn delete_user(&self, id: &UserId) -> Result<(), AppError> {
        self.repo
            .get_by_id(id)
            .await?
            .ok_or_else(UserError::not_found)?;
        self.repo.delete(id).await
    }
}

#[cfg(test)]
mod tests {
    use super::super::UserStatus;
    use super::*;
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockUserRepo {
        users: Mutex<Vec<User>>,
    }

    impl MockUserRepo {
        fn new() -> Self {
            Self {
                users: Mutex::new(Vec::new()),
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
        async fn get_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
            Ok(self
                .users
                .lock()
                .await
                .iter()
                .find(|u| u.email == email)
                .cloned())
        }
        async fn find(
            &self,
            opts: &PaginationOptions,
            _filter: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            let users = self.users.lock().await;
            let total = users.len() as i64;
            let start = opts.offset() as usize;
            let items: Vec<User> = users
                .iter()
                .skip(start)
                .take(opts.limit() as usize)
                .cloned()
                .collect();
            Ok(Paginated::new(items, opts.page, opts.page_size, total))
        }
        async fn save(&self, user: &User) -> Result<(), AppError> {
            self.users.lock().await.push(user.clone());
            Ok(())
        }
        async fn update(&self, user: &User) -> Result<(), AppError> {
            let mut users = self.users.lock().await;
            if let Some(u) = users.iter_mut().find(|u| u.id == user.id) {
                *u = user.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &UserId) -> Result<(), AppError> {
            self.users.lock().await.retain(|u| u.id != *id);
            Ok(())
        }
    }

    struct MockPasswordSvc;

    impl PasswordService for MockPasswordSvc {
        fn hash_password(&self, password: &str) -> Result<String, AppError> {
            Ok(format!("hashed_{password}"))
        }
        fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AppError> {
            Ok(hash == format!("hashed_{password}"))
        }
    }

    fn make_svc(repo: MockUserRepo) -> UserService {
        UserService::new(Arc::new(repo), Arc::new(MockPasswordSvc))
    }

    fn create_req(email: &str, name: &str) -> CreateUserRequest {
        CreateUserRequest {
            email: email.into(),
            name: name.into(),
            password: "password123".into(),
        }
    }

    // ========================================================================
    // create_user
    // ========================================================================

    #[tokio::test]
    async fn create_user_success() {
        let svc = make_svc(MockUserRepo::new());
        let res = svc
            .create_user(create_req("test@example.com", "Test User"))
            .await
            .unwrap();
        assert_eq!(res.email, "test@example.com");
        assert_eq!(res.name, "Test User");
        assert!(res.has_password);
    }

    #[tokio::test]
    async fn create_user_duplicate_email() {
        let svc = make_svc(MockUserRepo::new());
        svc.create_user(create_req("test@example.com", "User"))
            .await
            .unwrap();
        let err = svc
            .create_user(create_req("test@example.com", "Other"))
            .await
            .unwrap_err();
        assert_eq!(err.code, "user.already_exists");
    }

    #[tokio::test]
    async fn create_user_invalid_email() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc
            .create_user(create_req("bademail", "User"))
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_user_short_name() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc
            .create_user(create_req("a@b.com", "A"))
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_user / get_user_by_email
    // ========================================================================

    #[tokio::test]
    async fn get_user_success() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        let found = svc.get_user(&created.id).await.unwrap();
        assert_eq!(found.email, "a@b.com");
    }

    #[tokio::test]
    async fn get_user_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc.get_user(&UserId::new()).await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn get_user_by_email_success() {
        let svc = make_svc(MockUserRepo::new());
        svc.create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        let found = svc.get_user_by_email("a@b.com").await.unwrap();
        assert_eq!(found.name, "Test");
    }

    #[tokio::test]
    async fn get_user_by_email_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc.get_user_by_email("nope@x.com").await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    // ========================================================================
    // update_user
    // ========================================================================

    #[tokio::test]
    async fn update_user_name() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Old Name"))
            .await
            .unwrap();
        let updated = svc
            .update_user(
                &created.id,
                UpdateUserRequest {
                    name: Some("New Name".into()),
                    status: None,
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.name, "New Name");
    }

    #[tokio::test]
    async fn update_user_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc
            .update_user(
                &UserId::new(),
                UpdateUserRequest {
                    name: Some("Valid".into()),
                    status: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn update_user_short_name() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        let err = svc
            .update_user(
                &created.id,
                UpdateUserRequest {
                    name: Some("A".into()),
                    status: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn update_user_activate() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        assert_eq!(created.status, UserStatus::Pending);
        let updated = svc
            .update_user(
                &created.id,
                UpdateUserRequest {
                    name: None,
                    status: Some(UserStatus::Active),
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.status, UserStatus::Active);
    }

    #[tokio::test]
    async fn update_user_suspend() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        // First activate
        svc.activate_user(&created.id).await.unwrap();
        let updated = svc
            .update_user(
                &created.id,
                UpdateUserRequest {
                    name: None,
                    status: Some(UserStatus::Suspended),
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.status, UserStatus::Suspended);
    }

    // ========================================================================
    // activate_user / suspend_user
    // ========================================================================

    #[tokio::test]
    async fn activate_user_success() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        let activated = svc.activate_user(&created.id).await.unwrap();
        assert_eq!(activated.status, UserStatus::Active);
    }

    #[tokio::test]
    async fn activate_user_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc.activate_user(&UserId::new()).await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn activate_user_already_active() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        svc.activate_user(&created.id).await.unwrap();
        let err = svc.activate_user(&created.id).await.unwrap_err();
        assert_eq!(err.code, "user.invalid_status");
    }

    #[tokio::test]
    async fn suspend_user_success() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        svc.activate_user(&created.id).await.unwrap();
        let suspended = svc.suspend_user(&created.id, "bad behavior").await.unwrap();
        assert_eq!(suspended.status, UserStatus::Suspended);
    }

    #[tokio::test]
    async fn suspend_user_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc
            .suspend_user(&UserId::new(), "reason")
            .await
            .unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn suspend_user_not_active() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        let err = svc.suspend_user(&created.id, "reason").await.unwrap_err();
        assert_eq!(err.code, "user.invalid_status");
    }

    // ========================================================================
    // delete_user
    // ========================================================================

    #[tokio::test]
    async fn delete_user_success() {
        let svc = make_svc(MockUserRepo::new());
        let created = svc
            .create_user(create_req("a@b.com", "Test"))
            .await
            .unwrap();
        svc.delete_user(&created.id).await.unwrap();
        let err = svc.get_user(&created.id).await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn delete_user_not_found() {
        let svc = make_svc(MockUserRepo::new());
        let err = svc.delete_user(&UserId::new()).await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }
}
