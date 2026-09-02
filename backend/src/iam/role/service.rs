use std::sync::Arc;

use crate::error::AppError;
use crate::iam::scopes;
use crate::iam::user::{UserError, UserRepository};
use crate::kernel::{RoleId, UserId};

use super::{
    CreateRoleRequest, Role, RoleError, RoleRepository, RoleResponse, UpdateRoleRequest,
    UserRolesResponse,
};

pub struct RoleService {
    repo: Arc<dyn RoleRepository>,
    user_repo: Arc<dyn UserRepository>,
}

impl RoleService {
    pub fn new(repo: Arc<dyn RoleRepository>, user_repo: Arc<dyn UserRepository>) -> Self {
        Self { repo, user_repo }
    }

    pub async fn create_role(&self, req: CreateRoleRequest) -> Result<RoleResponse, AppError> {
        req.validate()?;
        validate_scopes(&req.scopes)?;

        // Check for duplicate name
        if self.repo.get_by_name(&req.name).await?.is_some() {
            return Err(RoleError::already_exists().with_detail("name", req.name));
        }

        let role = Role::new(req.name, req.description.unwrap_or_default(), req.scopes);

        self.repo.save(&role).await?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn get_role(&self, id: &RoleId) -> Result<RoleResponse, AppError> {
        let role = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(RoleError::not_found)?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn list_roles(&self) -> Result<Vec<RoleResponse>, AppError> {
        let roles = self.repo.list_all().await?;
        Ok(roles.iter().map(RoleResponse::from).collect())
    }

    pub async fn update_role(
        &self,
        id: &RoleId,
        req: UpdateRoleRequest,
    ) -> Result<RoleResponse, AppError> {
        req.validate()?;
        let mut role = self
            .repo
            .get_by_id(id)
            .await?
            .ok_or_else(RoleError::not_found)?;

        if let Some(name) = req.name {
            // Check for duplicate name (exclude current role)
            if let Some(existing) = self.repo.get_by_name(&name).await?
                && existing.id != role.id
            {
                return Err(RoleError::already_exists().with_detail("name", name));
            }
            role.name = name;
        }

        if let Some(description) = req.description {
            role.description = description;
        }

        if let Some(new_scopes) = req.scopes {
            validate_scopes(&new_scopes)?;
            role.set_scopes(new_scopes);
        }

        role.updated_at = chrono::Utc::now();
        self.repo.save(&role).await?;
        Ok(RoleResponse::from(&role))
    }

    pub async fn delete_role(&self, id: &RoleId) -> Result<(), AppError> {
        self.repo
            .get_by_id(id)
            .await?
            .ok_or_else(RoleError::not_found)?;
        self.repo.delete(id).await
    }

    pub async fn assign_role_to_user(
        &self,
        role_id: &RoleId,
        user_id: &UserId,
    ) -> Result<(), AppError> {
        self.repo
            .get_by_id(role_id)
            .await?
            .ok_or_else(RoleError::not_found)?;

        self.user_repo
            .get_by_id(user_id)
            .await?
            .ok_or_else(UserError::not_found)?;

        self.repo.assign_to_user(user_id, role_id).await
    }

    pub async fn unassign_role_from_user(
        &self,
        role_id: &RoleId,
        user_id: &UserId,
    ) -> Result<(), AppError> {
        self.repo.unassign_from_user(user_id, role_id).await
    }

    pub async fn get_user_roles(&self, user_id: &UserId) -> Result<UserRolesResponse, AppError> {
        self.user_repo
            .get_by_id(user_id)
            .await?
            .ok_or_else(UserError::not_found)?;

        let roles = self.repo.list_by_user(user_id).await?;
        let effective_scopes = resolve_effective_scopes(&roles);
        let role_dtos = roles.iter().map(RoleResponse::from).collect();

        Ok(UserRolesResponse {
            user_id: user_id.clone(),
            roles: role_dtos,
            effective_scopes,
        })
    }

    pub async fn get_effective_scopes(&self, user_id: &UserId) -> Result<Vec<String>, AppError> {
        self.user_repo
            .get_by_id(user_id)
            .await?
            .ok_or_else(UserError::not_found)?;

        let roles = self.repo.list_by_user(user_id).await?;
        Ok(resolve_effective_scopes(&roles))
    }
}

fn validate_scopes(scope_list: &[String]) -> Result<(), AppError> {
    if scope_list.is_empty() {
        return Err(
            RoleError::invalid_scopes().with_detail("reason", "at least one scope is required")
        );
    }

    let invalid: Vec<&String> = scope_list
        .iter()
        .filter(|s| !scopes::validate_scope(s))
        .collect();

    if !invalid.is_empty() {
        let names: Vec<&str> = invalid.iter().map(|s| s.as_str()).collect();
        return Err(RoleError::invalid_scopes()
            .with_detail("invalid_scopes", serde_json::json!(names))
            .with_detail("hint", "Use the scope catalog to see valid options"));
    }

    Ok(())
}

fn resolve_effective_scopes(roles: &[Role]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for role in roles {
        for scope in &role.scopes {
            if seen.insert(scope.clone()) {
                result.push(scope.clone());
            }
        }
    }

    result
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

    struct MockRoleRepo {
        roles: Mutex<Vec<Role>>,
        assignments: Mutex<Vec<(UserId, RoleId)>>,
    }

    impl MockRoleRepo {
        fn new() -> Self {
            Self {
                roles: Mutex::new(Vec::new()),
                assignments: Mutex::new(Vec::new()),
            }
        }
    }

    #[async_trait::async_trait]
    impl RoleRepository for MockRoleRepo {
        async fn save(&self, role: &Role) -> Result<(), AppError> {
            let mut roles = self.roles.lock().await;
            if let Some(r) = roles.iter_mut().find(|r| r.id == role.id) {
                *r = role.clone();
            } else {
                roles.push(role.clone());
            }
            Ok(())
        }
        async fn get_by_id(&self, id: &RoleId) -> Result<Option<Role>, AppError> {
            Ok(self
                .roles
                .lock()
                .await
                .iter()
                .find(|r| r.id == *id)
                .cloned())
        }
        async fn get_by_name(&self, name: &str) -> Result<Option<Role>, AppError> {
            Ok(self
                .roles
                .lock()
                .await
                .iter()
                .find(|r| r.name == name)
                .cloned())
        }
        async fn list_all(&self) -> Result<Vec<Role>, AppError> {
            Ok(self.roles.lock().await.clone())
        }
        async fn delete(&self, id: &RoleId) -> Result<(), AppError> {
            self.roles.lock().await.retain(|r| r.id != *id);
            Ok(())
        }
        async fn assign_to_user(&self, user_id: &UserId, role_id: &RoleId) -> Result<(), AppError> {
            self.assignments
                .lock()
                .await
                .push((user_id.clone(), role_id.clone()));
            Ok(())
        }
        async fn unassign_from_user(
            &self,
            user_id: &UserId,
            role_id: &RoleId,
        ) -> Result<(), AppError> {
            self.assignments
                .lock()
                .await
                .retain(|(u, r)| u != user_id || r != role_id);
            Ok(())
        }
        async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<Role>, AppError> {
            let assignments = self.assignments.lock().await;
            let role_ids: Vec<RoleId> = assignments
                .iter()
                .filter(|(u, _)| u == user_id)
                .map(|(_, r)| r.clone())
                .collect();
            let roles = self.roles.lock().await;
            Ok(roles
                .iter()
                .filter(|r| role_ids.contains(&r.id))
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
        async fn get_by_email(&self, _email: &str) -> Result<Option<User>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _opts: &PaginationOptions,
            _filter: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn save(&self, _user: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn update(&self, _user: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _id: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    fn make_svc(role_repo: MockRoleRepo, user_repo: MockUserRepo) -> RoleService {
        RoleService::new(Arc::new(role_repo), Arc::new(user_repo))
    }

    fn create_req(name: &str, scopes: Vec<&str>) -> CreateRoleRequest {
        CreateRoleRequest {
            name: name.into(),
            description: Some("Test role".into()),
            scopes: scopes.into_iter().map(String::from).collect(),
        }
    }

    // ========================================================================
    // create_role
    // ========================================================================

    #[tokio::test]
    async fn create_role_success() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let res = svc
            .create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        assert_eq!(res.name, "Admin");
        assert_eq!(res.scopes, vec!["movies:read"]);
    }

    #[tokio::test]
    async fn create_role_duplicate_name() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        svc.create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        let err = svc
            .create_role(create_req("Admin", vec!["movies:write"]))
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.already_exists");
    }

    #[tokio::test]
    async fn create_role_invalid_scopes() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc
            .create_role(create_req("Bad", vec!["not:valid:scope"]))
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.invalid_scopes");
    }

    #[tokio::test]
    async fn create_role_empty_scopes() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc
            .create_role(CreateRoleRequest {
                name: "Empty".into(),
                description: None,
                scopes: vec![],
            })
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn create_role_short_name() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc
            .create_role(create_req("A", vec!["movies:read"]))
            .await
            .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    // ========================================================================
    // get_role / list_roles
    // ========================================================================

    #[tokio::test]
    async fn get_role_success() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let created = svc
            .create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        let found = svc.get_role(&created.id).await.unwrap();
        assert_eq!(found.name, "Admin");
    }

    #[tokio::test]
    async fn get_role_not_found() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc.get_role(&RoleId::new()).await.unwrap_err();
        assert_eq!(err.code, "role.not_found");
    }

    #[tokio::test]
    async fn list_roles_returns_all() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        svc.create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        svc.create_role(create_req("Editor", vec!["movies:write"]))
            .await
            .unwrap();
        let roles = svc.list_roles().await.unwrap();
        assert_eq!(roles.len(), 2);
    }

    // ========================================================================
    // update_role
    // ========================================================================

    #[tokio::test]
    async fn update_role_success() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let created = svc
            .create_role(create_req("Old", vec!["movies:read"]))
            .await
            .unwrap();
        let updated = svc
            .update_role(
                &created.id,
                UpdateRoleRequest {
                    name: Some("New".into()),
                    description: Some("Updated".into()),
                    scopes: Some(vec!["movies:write".into()]),
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.name, "New");
        assert_eq!(updated.description, "Updated");
        assert_eq!(updated.scopes, vec!["movies:write"]);
    }

    #[tokio::test]
    async fn update_role_not_found() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc
            .update_role(
                &RoleId::new(),
                UpdateRoleRequest {
                    name: Some("Valid".into()),
                    description: None,
                    scopes: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.not_found");
    }

    #[tokio::test]
    async fn update_role_duplicate_name() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        svc.create_role(create_req("Taken", vec!["movies:read"]))
            .await
            .unwrap();
        let other = svc
            .create_role(create_req("Other", vec!["movies:read"]))
            .await
            .unwrap();
        let err = svc
            .update_role(
                &other.id,
                UpdateRoleRequest {
                    name: Some("Taken".into()),
                    description: None,
                    scopes: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.already_exists");
    }

    #[tokio::test]
    async fn update_role_invalid_scopes() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let created = svc
            .create_role(create_req("Role", vec!["movies:read"]))
            .await
            .unwrap();
        let err = svc
            .update_role(
                &created.id,
                UpdateRoleRequest {
                    name: None,
                    description: None,
                    scopes: Some(vec!["bad:scope".into()]),
                },
            )
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.invalid_scopes");
    }

    // ========================================================================
    // delete_role
    // ========================================================================

    #[tokio::test]
    async fn delete_role_success() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let created = svc
            .create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        svc.delete_role(&created.id).await.unwrap();
        let err = svc.get_role(&created.id).await.unwrap_err();
        assert_eq!(err.code, "role.not_found");
    }

    #[tokio::test]
    async fn delete_role_not_found() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc.delete_role(&RoleId::new()).await.unwrap_err();
        assert_eq!(err.code, "role.not_found");
    }

    // ========================================================================
    // assign / unassign / get_user_roles
    // ========================================================================

    #[tokio::test]
    async fn assign_role_to_user_success() {
        let user = User::new_with_password("a@b.com".into(), "Test".into(), "hash".into());
        let user_id = user.id.clone();
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::with_user(user));
        let role = svc
            .create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        svc.assign_role_to_user(&role.id, &user_id).await.unwrap();
    }

    #[tokio::test]
    async fn assign_role_not_found() {
        let user = User::new_with_password("a@b.com".into(), "Test".into(), "hash".into());
        let user_id = user.id.clone();
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::with_user(user));
        let err = svc
            .assign_role_to_user(&RoleId::new(), &user_id)
            .await
            .unwrap_err();
        assert_eq!(err.code, "role.not_found");
    }

    #[tokio::test]
    async fn assign_role_user_not_found() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let role = svc
            .create_role(create_req("Admin", vec!["movies:read"]))
            .await
            .unwrap();
        let err = svc
            .assign_role_to_user(&role.id, &UserId::new())
            .await
            .unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn get_user_roles_with_effective_scopes() {
        let user = User::new_with_password("a@b.com".into(), "Test".into(), "hash".into());
        let user_id = user.id.clone();
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::with_user(user));

        let r1 = svc
            .create_role(create_req("R1", vec!["movies:read", "movies:write"]))
            .await
            .unwrap();
        let r2 = svc
            .create_role(create_req("R2", vec!["movies:read", "tracks:read"]))
            .await
            .unwrap();
        svc.assign_role_to_user(&r1.id, &user_id).await.unwrap();
        svc.assign_role_to_user(&r2.id, &user_id).await.unwrap();

        let result = svc.get_user_roles(&user_id).await.unwrap();
        assert_eq!(result.roles.len(), 2);
        // users:read should be deduplicated
        assert_eq!(result.effective_scopes.len(), 3);
        assert!(result.effective_scopes.contains(&"movies:read".to_string()));
        assert!(
            result
                .effective_scopes
                .contains(&"movies:write".to_string())
        );
        assert!(result.effective_scopes.contains(&"tracks:read".to_string()));
    }

    #[tokio::test]
    async fn get_user_roles_user_not_found() {
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::new());
        let err = svc.get_user_roles(&UserId::new()).await.unwrap_err();
        assert_eq!(err.code, "user.not_found");
    }

    #[tokio::test]
    async fn get_effective_scopes_deduplicates() {
        let user = User::new_with_password("a@b.com".into(), "Test".into(), "hash".into());
        let user_id = user.id.clone();
        let svc = make_svc(MockRoleRepo::new(), MockUserRepo::with_user(user));

        let r1 = svc
            .create_role(create_req("R1", vec!["movies:read"]))
            .await
            .unwrap();
        let r2 = svc
            .create_role(create_req("R2", vec!["movies:read"]))
            .await
            .unwrap();
        svc.assign_role_to_user(&r1.id, &user_id).await.unwrap();
        svc.assign_role_to_user(&r2.id, &user_id).await.unwrap();

        let scopes = svc.get_effective_scopes(&user_id).await.unwrap();
        assert_eq!(scopes, vec!["movies:read"]);
    }
}
