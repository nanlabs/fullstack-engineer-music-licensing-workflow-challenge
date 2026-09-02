use std::sync::Arc;

use crate::error::AppError;
use crate::iam::role::RoleRepository;
use crate::iam::user::{OAuthProvider, PasswordService, User, UserError, UserRepository};
use crate::kernel::UserId;

use super::config::AuthConfig;
use super::error::AuthError;
use super::model::{
    LoginMetadata, LoginRequest, OAuthUserInfo, RefreshToken, TokenClaims, TokenPair, UserSession,
};
use super::port::{SessionRepository, TokenRepository, TokenService};

pub struct AuthService {
    user_repo: Arc<dyn UserRepository>,
    password_svc: Arc<dyn PasswordService>,
    token_svc: Arc<dyn TokenService>,
    token_repo: Arc<dyn TokenRepository>,
    session_repo: Arc<dyn SessionRepository>,
    role_repo: Arc<dyn RoleRepository>,
    config: AuthConfig,
}

impl AuthService {
    pub fn new(
        user_repo: Arc<dyn UserRepository>,
        password_svc: Arc<dyn PasswordService>,
        token_svc: Arc<dyn TokenService>,
        token_repo: Arc<dyn TokenRepository>,
        session_repo: Arc<dyn SessionRepository>,
        role_repo: Arc<dyn RoleRepository>,
        config: AuthConfig,
    ) -> Self {
        Self {
            user_repo,
            password_svc,
            token_svc,
            token_repo,
            session_repo,
            role_repo,
            config,
        }
    }

    // ========================================================================
    // Login
    // ========================================================================

    pub async fn login_with_password(
        &self,
        req: LoginRequest,
        meta: LoginMetadata,
    ) -> Result<TokenPair, AppError> {
        let user = self
            .user_repo
            .get_by_email(&req.email)
            .await?
            .ok_or_else(AuthError::invalid_credentials)?;

        let password_hash = user
            .password_hash
            .as_ref()
            .ok_or_else(AuthError::invalid_credentials)?;

        let valid = self
            .password_svc
            .verify_password(&req.password, password_hash)?;
        if !valid {
            return Err(AuthError::invalid_credentials());
        }

        if !user.can_login() {
            return Err(AuthError::account_disabled());
        }

        self.create_session_and_tokens(&user, meta).await
    }

    pub async fn find_or_create_oauth_user(
        &self,
        user_info: OAuthUserInfo,
        provider: OAuthProvider,
        meta: LoginMetadata,
    ) -> Result<TokenPair, AppError> {
        let user = match self.user_repo.get_by_email(&user_info.email).await? {
            Some(mut existing) => {
                if existing.oauth_provider.as_ref() != Some(&provider)
                    || existing.oauth_provider_id.as_deref() != Some(&user_info.id)
                {
                    existing.link_oauth(provider, user_info.id);
                    existing.update_profile(Some(user_info.name), user_info.picture);
                    self.user_repo.update(&existing).await?;
                }
                existing
            }
            None => {
                let new_user = User::new_with_oauth(
                    user_info.email,
                    user_info.name,
                    user_info.picture,
                    provider,
                    user_info.id,
                );
                self.user_repo.save(&new_user).await?;
                new_user
            }
        };

        if !user.can_login() {
            return Err(AuthError::account_disabled());
        }

        self.create_session_and_tokens(&user, meta).await
    }

    // ========================================================================
    // Token Refresh — rotates within the same session
    // ========================================================================

    pub async fn refresh_tokens(&self, refresh_token: &str) -> Result<TokenPair, AppError> {
        // Validate the JWT signature/expiry
        let user_id = self
            .token_svc
            .validate_refresh_token(refresh_token)
            .map_err(|_| AuthError::invalid_refresh_token())?;

        // Check the DB record
        let stored = self
            .token_repo
            .get_refresh_token(refresh_token)
            .await?
            .ok_or_else(AuthError::invalid_refresh_token)?;

        if !stored.is_valid() {
            return Err(if stored.is_revoked {
                AuthError::invalid_refresh_token()
            } else {
                AuthError::expired_refresh_token()
            });
        }

        // Revoke old token
        self.token_repo.revoke_refresh_token(refresh_token).await?;

        // Update session activity
        self.session_repo
            .update_activity(&stored.session_id)
            .await?;

        // Get user and generate new token pair within the same session
        let user = self
            .user_repo
            .get_by_id(&user_id)
            .await?
            .ok_or_else(UserError::not_found)?;

        if !user.can_login() {
            return Err(AuthError::account_disabled());
        }

        self.generate_token_pair(&user, &stored.session_id).await
    }

    // ========================================================================
    // Logout
    // ========================================================================

    /// Logout a single session — deleting the session cascades to its
    /// refresh tokens (FK ON DELETE CASCADE), so this is atomic.
    pub async fn logout(&self, refresh_token: &str) -> Result<(), AppError> {
        // Find the token to get its session_id
        if let Some(stored) = self.token_repo.get_refresh_token(refresh_token).await? {
            self.session_repo.revoke(&stored.session_id).await?;
        }
        Ok(())
    }

    /// Logout all sessions — deleting the sessions cascades to all their
    /// refresh tokens (FK ON DELETE CASCADE), so this is atomic.
    pub async fn logout_all(&self, user_id: &UserId) -> Result<(), AppError> {
        self.session_repo.revoke_all_for_user(user_id).await
    }

    // ========================================================================
    // Session Management
    // ========================================================================

    pub async fn list_user_sessions(&self, user_id: &UserId) -> Result<Vec<UserSession>, AppError> {
        self.session_repo.list_by_user(user_id).await
    }

    /// Revoke a specific session by ID — deleting it cascades to its
    /// refresh tokens (FK ON DELETE CASCADE), so this is atomic.
    pub async fn revoke_session(&self, session_id: &str) -> Result<(), AppError> {
        self.session_repo.revoke(session_id).await
    }

    pub async fn clean_expired_sessions(&self) -> Result<(), AppError> {
        self.session_repo.clean_expired().await
    }

    // ========================================================================
    // Private
    // ========================================================================

    /// Creates a new session + first token pair (used on login)
    async fn create_session_and_tokens(
        &self,
        user: &User,
        meta: LoginMetadata,
    ) -> Result<TokenPair, AppError> {
        let session = UserSession::new(
            user.id.clone(),
            meta.ip_address,
            meta.user_agent,
            self.config.jwt.refresh_token_ttl,
        );
        self.session_repo.save(&session).await?;

        self.generate_token_pair(user, &session.id).await
    }

    /// Generates access + refresh tokens linked to an existing session
    async fn generate_token_pair(
        &self,
        user: &User,
        session_id: &str,
    ) -> Result<TokenPair, AppError> {
        let scopes = self.resolve_effective_scopes(&user.id).await?;

        let claims = TokenClaims {
            user_id: user.id.clone(),
            email: user.email.clone(),
            name: user.name.clone(),
            scopes,
        };

        let access_token = self.token_svc.generate_access_token(&claims)?;
        let refresh_token_str = self.token_svc.generate_refresh_token(&user.id)?;

        let refresh_token = RefreshToken::new(
            user.id.clone(),
            session_id.to_string(),
            refresh_token_str.clone(),
            self.config.jwt.refresh_token_ttl,
        );
        self.token_repo.save_refresh_token(&refresh_token).await?;

        Ok(TokenPair {
            access_token,
            refresh_token: refresh_token_str,
            token_type: "Bearer".to_string(),
            expires_in: self.config.jwt.access_token_ttl.as_secs() as i64,
        })
    }

    async fn resolve_effective_scopes(&self, user_id: &UserId) -> Result<Vec<String>, AppError> {
        let roles = self.role_repo.list_by_user(user_id).await?;
        let mut seen = std::collections::HashSet::new();
        let mut scopes = Vec::new();
        for role in &roles {
            for scope in &role.scopes {
                if seen.insert(scope.clone()) {
                    scopes.push(scope.clone());
                }
            }
        }
        Ok(scopes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iam::role::Role;
    use crate::iam::user::model::UserFilter;
    use crate::kernel::{Paginated, PaginationOptions, RoleId};
    use std::time::Duration;
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
        async fn add(&self, user: User) {
            self.users.lock().await.push(user);
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
            _opts: &PaginationOptions,
            _f: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
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
        async fn delete(&self, _id: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockPasswordSvc;
    impl PasswordService for MockPasswordSvc {
        fn hash_password(&self, pw: &str) -> Result<String, AppError> {
            Ok(format!("hashed_{pw}"))
        }
        fn verify_password(&self, pw: &str, hash: &str) -> Result<bool, AppError> {
            Ok(hash == format!("hashed_{pw}"))
        }
    }

    struct MockTokenSvc;
    impl TokenService for MockTokenSvc {
        fn generate_access_token(&self, claims: &TokenClaims) -> Result<String, AppError> {
            Ok(format!("access_{}", claims.user_id))
        }
        fn validate_access_token(&self, _token: &str) -> Result<TokenClaims, AppError> {
            Err(AppError::internal("not used"))
        }
        fn generate_refresh_token(&self, user_id: &UserId) -> Result<String, AppError> {
            Ok(format!("refresh_{}_{}", user_id, uuid::Uuid::new_v4()))
        }
        fn validate_refresh_token(&self, token: &str) -> Result<UserId, AppError> {
            // Parse user_id from "refresh_{user_id}_{uuid}"
            let parts: Vec<&str> = token.splitn(3, '_').collect();
            if parts.len() >= 2 && parts[0] == "refresh" {
                Ok(UserId::from_string(parts[1].to_string()))
            } else {
                Err(AppError::authorization("invalid token"))
            }
        }
    }

    struct MockTokenRepo {
        tokens: Mutex<Vec<RefreshToken>>,
    }
    impl MockTokenRepo {
        fn new() -> Self {
            Self {
                tokens: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl TokenRepository for MockTokenRepo {
        async fn save_refresh_token(&self, token: &RefreshToken) -> Result<(), AppError> {
            self.tokens.lock().await.push(token.clone());
            Ok(())
        }
        async fn get_refresh_token(&self, token: &str) -> Result<Option<RefreshToken>, AppError> {
            Ok(self
                .tokens
                .lock()
                .await
                .iter()
                .find(|t| t.token == token)
                .cloned())
        }
        async fn revoke_refresh_token(&self, token: &str) -> Result<(), AppError> {
            let mut tokens = self.tokens.lock().await;
            if let Some(t) = tokens.iter_mut().find(|t| t.token == token) {
                t.is_revoked = true;
            }
            Ok(())
        }
        async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError> {
            let mut tokens = self.tokens.lock().await;
            for t in tokens.iter_mut().filter(|t| t.user_id == *user_id) {
                t.is_revoked = true;
            }
            Ok(())
        }
        async fn revoke_by_session(&self, session_id: &str) -> Result<(), AppError> {
            let mut tokens = self.tokens.lock().await;
            for t in tokens.iter_mut().filter(|t| t.session_id == session_id) {
                t.is_revoked = true;
            }
            Ok(())
        }
    }

    struct MockSessionRepo {
        sessions: Mutex<Vec<UserSession>>,
    }
    impl MockSessionRepo {
        fn new() -> Self {
            Self {
                sessions: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl SessionRepository for MockSessionRepo {
        async fn save(&self, session: &UserSession) -> Result<(), AppError> {
            self.sessions.lock().await.push(session.clone());
            Ok(())
        }
        async fn get_by_id(&self, id: &str) -> Result<Option<UserSession>, AppError> {
            Ok(self
                .sessions
                .lock()
                .await
                .iter()
                .find(|s| s.id == id)
                .cloned())
        }
        async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<UserSession>, AppError> {
            Ok(self
                .sessions
                .lock()
                .await
                .iter()
                .filter(|s| s.user_id == *user_id)
                .cloned()
                .collect())
        }
        async fn update_activity(&self, _session_id: &str) -> Result<(), AppError> {
            Ok(())
        }
        async fn revoke(&self, session_id: &str) -> Result<(), AppError> {
            self.sessions.lock().await.retain(|s| s.id != session_id);
            Ok(())
        }
        async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError> {
            self.sessions.lock().await.retain(|s| s.user_id != *user_id);
            Ok(())
        }
        async fn clean_expired(&self) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockRoleRepo;
    #[async_trait::async_trait]
    impl RoleRepository for MockRoleRepo {
        async fn save(&self, _role: &Role) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, _id: &RoleId) -> Result<Option<Role>, AppError> {
            Ok(None)
        }
        async fn get_by_name(&self, _name: &str) -> Result<Option<Role>, AppError> {
            Ok(None)
        }
        async fn list_all(&self) -> Result<Vec<Role>, AppError> {
            Ok(vec![])
        }
        async fn delete(&self, _id: &RoleId) -> Result<(), AppError> {
            Ok(())
        }
        async fn assign_to_user(&self, _uid: &UserId, _rid: &RoleId) -> Result<(), AppError> {
            Ok(())
        }
        async fn unassign_from_user(&self, _uid: &UserId, _rid: &RoleId) -> Result<(), AppError> {
            Ok(())
        }
        async fn list_by_user(&self, _uid: &UserId) -> Result<Vec<Role>, AppError> {
            Ok(vec![])
        }
    }

    fn test_config() -> AuthConfig {
        AuthConfig {
            jwt: super::super::config::JWTConfig {
                secret_key: "test-secret-key-that-is-long-enough-32chars!!".into(),
                access_token_ttl: Duration::from_secs(900),
                refresh_token_ttl: Duration::from_secs(604800),
                issuer: "test".into(),
            },
            oauth: Default::default(),
        }
    }

    fn make_active_user(email: &str) -> User {
        let mut user =
            User::new_with_password(email.into(), "Test".into(), "hashed_password123".into());
        user.status = crate::iam::user::UserStatus::Active;
        user.email_verified = true;
        user
    }

    fn make_svc(
        user_repo: MockUserRepo,
        token_repo: MockTokenRepo,
        session_repo: MockSessionRepo,
    ) -> AuthService {
        AuthService::new(
            Arc::new(user_repo),
            Arc::new(MockPasswordSvc),
            Arc::new(MockTokenSvc),
            Arc::new(token_repo),
            Arc::new(session_repo),
            Arc::new(MockRoleRepo),
            test_config(),
        )
    }

    fn login_req(email: &str, password: &str) -> LoginRequest {
        LoginRequest {
            email: email.into(),
            password: password.into(),
        }
    }

    fn meta() -> LoginMetadata {
        LoginMetadata {
            ip_address: "127.0.0.1".into(),
            user_agent: "test".into(),
        }
    }

    // ========================================================================
    // login_with_password
    // ========================================================================

    #[tokio::test]
    async fn login_success() {
        let user_repo = MockUserRepo::new();
        user_repo.add(make_active_user("a@b.com")).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        let pair = svc
            .login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        assert!(pair.access_token.starts_with("access_"));
        assert!(pair.refresh_token.starts_with("refresh_"));
        assert_eq!(pair.token_type, "Bearer");
    }

    #[tokio::test]
    async fn login_user_not_found() {
        let svc = make_svc(
            MockUserRepo::new(),
            MockTokenRepo::new(),
            MockSessionRepo::new(),
        );
        let err = svc
            .login_with_password(login_req("nope@x.com", "pw"), meta())
            .await
            .unwrap_err();
        assert_eq!(err.code, "auth.invalid_credentials");
    }

    #[tokio::test]
    async fn login_wrong_password() {
        let user_repo = MockUserRepo::new();
        user_repo.add(make_active_user("a@b.com")).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        let err = svc
            .login_with_password(login_req("a@b.com", "wrong"), meta())
            .await
            .unwrap_err();
        assert_eq!(err.code, "auth.invalid_credentials");
    }

    #[tokio::test]
    async fn login_oauth_only_user() {
        let user_repo = MockUserRepo::new();
        let user = User::new_with_oauth(
            "oauth@b.com".into(),
            "OAuth".into(),
            None,
            OAuthProvider::Google,
            "gid123".into(),
        );
        user_repo.add(user).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        let err = svc
            .login_with_password(login_req("oauth@b.com", "any"), meta())
            .await
            .unwrap_err();
        assert_eq!(err.code, "auth.invalid_credentials");
    }

    #[tokio::test]
    async fn login_account_disabled() {
        let user_repo = MockUserRepo::new();
        // Pending user (not active)
        let user =
            User::new_with_password("a@b.com".into(), "Test".into(), "hashed_password123".into());
        user_repo.add(user).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        let err = svc
            .login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap_err();
        assert_eq!(err.code, "auth.account_disabled");
    }

    // ========================================================================
    // refresh_tokens
    // ========================================================================

    #[tokio::test]
    async fn refresh_success() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        user_repo.add(user).await;

        let token_repo = MockTokenRepo::new();
        let session_repo = MockSessionRepo::new();

        let svc = make_svc(user_repo, token_repo, session_repo);
        // Login to get initial tokens
        let pair = svc
            .login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();

        // Refresh
        let new_pair = svc.refresh_tokens(&pair.refresh_token).await.unwrap();
        assert!(new_pair.access_token.starts_with("access_"));
        assert_ne!(new_pair.refresh_token, pair.refresh_token);
    }

    #[tokio::test]
    async fn refresh_invalid_token() {
        let svc = make_svc(
            MockUserRepo::new(),
            MockTokenRepo::new(),
            MockSessionRepo::new(),
        );
        let err = svc.refresh_tokens("garbage_token").await.unwrap_err();
        assert_eq!(err.code, "auth.invalid_refresh_token");
    }

    #[tokio::test]
    async fn refresh_token_not_in_db() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        user_repo.add(user.clone()).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        // Valid format but not stored in DB
        let fake_token = format!("refresh_{}_{}", user.id, uuid::Uuid::new_v4());
        let err = svc.refresh_tokens(&fake_token).await.unwrap_err();
        assert_eq!(err.code, "auth.invalid_refresh_token");
    }

    #[tokio::test]
    async fn refresh_revoked_token() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        user_repo.add(user).await;

        let token_repo = MockTokenRepo::new();
        let session_repo = MockSessionRepo::new();
        let svc = make_svc(user_repo, token_repo, session_repo);

        let pair = svc
            .login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        // Refresh once (revokes old)
        svc.refresh_tokens(&pair.refresh_token).await.unwrap();
        // Try to use the old token again
        let err = svc.refresh_tokens(&pair.refresh_token).await.unwrap_err();
        assert_eq!(err.code, "auth.invalid_refresh_token");
    }

    // ========================================================================
    // logout / logout_all
    // ========================================================================

    #[tokio::test]
    async fn logout_success() {
        let user_repo = MockUserRepo::new();
        user_repo.add(make_active_user("a@b.com")).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        let pair = svc
            .login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        svc.logout(&pair.refresh_token).await.unwrap();
    }

    #[tokio::test]
    async fn logout_unknown_token() {
        let svc = make_svc(
            MockUserRepo::new(),
            MockTokenRepo::new(),
            MockSessionRepo::new(),
        );
        // Should not error — idempotent
        svc.logout("nonexistent").await.unwrap();
    }

    #[tokio::test]
    async fn logout_all_success() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        let user_id = user.id.clone();
        user_repo.add(user).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        // Create two sessions
        svc.login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        svc.login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();

        svc.logout_all(&user_id).await.unwrap();
        let sessions = svc.list_user_sessions(&user_id).await.unwrap();
        assert_eq!(sessions.len(), 0);
    }

    // ========================================================================
    // session management
    // ========================================================================

    #[tokio::test]
    async fn list_sessions() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        let user_id = user.id.clone();
        user_repo.add(user).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        svc.login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        svc.login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();

        let sessions = svc.list_user_sessions(&user_id).await.unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[tokio::test]
    async fn revoke_session_success() {
        let user_repo = MockUserRepo::new();
        let user = make_active_user("a@b.com");
        let user_id = user.id.clone();
        user_repo.add(user).await;
        let svc = make_svc(user_repo, MockTokenRepo::new(), MockSessionRepo::new());

        svc.login_with_password(login_req("a@b.com", "password123"), meta())
            .await
            .unwrap();
        let sessions = svc.list_user_sessions(&user_id).await.unwrap();
        assert_eq!(sessions.len(), 1);

        svc.revoke_session(&sessions[0].id).await.unwrap();
        let sessions = svc.list_user_sessions(&user_id).await.unwrap();
        assert_eq!(sessions.len(), 0);
    }
}
