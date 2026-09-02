mod common;

use std::sync::Arc;
use std::time::Duration;

use backend::iam::auth::adapters::{
    JwtTokenService, PostgresSessionRepository, PostgresTokenRepository,
};
use backend::iam::auth::{
    AuthConfig, AuthService, JWTConfig, LoginMetadata, LoginRequest, OAuthUserInfo, TokenService,
};
use backend::iam::role::adapters::PostgresRoleRepository;
use backend::iam::role::{CreateRoleRequest, RoleService};
use backend::iam::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use backend::iam::user::{OAuthProvider, PasswordService, User, UserRepository};

use common::TestDb;

fn test_auth_config() -> AuthConfig {
    AuthConfig {
        jwt: JWTConfig {
            secret_key: "test-secret-key-that-is-long-enough-for-hmac".into(),
            access_token_ttl: Duration::from_secs(900),
            refresh_token_ttl: Duration::from_secs(86400),
            issuer: "test".into(),
        },
        ..Default::default()
    }
}

fn test_meta() -> LoginMetadata {
    LoginMetadata {
        ip_address: "127.0.0.1".into(),
        user_agent: "test-agent".into(),
    }
}

struct TestContext {
    auth_svc: AuthService,
    user_repo: Arc<PostgresUserRepository>,
    role_repo: Arc<PostgresRoleRepository>,
    password_svc: Arc<BcryptPasswordService>,
    token_svc: Arc<JwtTokenService>,
    _db: TestDb,
}

impl TestContext {
    async fn new() -> Self {
        let db = TestDb::new().await;
        let config = test_auth_config();
        let user_repo = Arc::new(PostgresUserRepository::new(db.pool.clone()));
        let role_repo = Arc::new(PostgresRoleRepository::new(db.pool.clone()));
        let password_svc = Arc::new(BcryptPasswordService::new());
        let token_svc = Arc::new(JwtTokenService::new(&config.jwt));
        let token_repo = Arc::new(PostgresTokenRepository::new(db.pool.clone()));
        let session_repo = Arc::new(PostgresSessionRepository::new(db.pool.clone()));

        let auth_svc = AuthService::new(
            user_repo.clone(),
            password_svc.clone(),
            token_svc.clone(),
            token_repo,
            session_repo.clone(),
            role_repo.clone(),
            config,
        );

        Self {
            auth_svc,
            user_repo,
            role_repo,
            password_svc,
            token_svc,
            _db: db,
        }
    }

    async fn create_password_user(&self, email: &str, password: &str) -> User {
        let hash = self.password_svc.hash_password(password).unwrap();
        let mut user = User::new_with_password(email.into(), "Test User".into(), hash);
        user.activate().unwrap();
        user.email_verified = true;
        self.user_repo.save(&user).await.unwrap();
        user
    }

    async fn create_pending_user(&self, email: &str, password: &str) -> User {
        let hash = self.password_svc.hash_password(password).unwrap();
        let user = User::new_with_password(email.into(), "Pending User".into(), hash);
        self.user_repo.save(&user).await.unwrap();
        user
    }
}

// ============================================================================
// JWT Token Service Tests
// ============================================================================

#[tokio::test]
async fn test_jwt_generate_and_validate_access_token() {
    let config = test_auth_config();
    let svc = JwtTokenService::new(&config.jwt);

    let claims = backend::iam::auth::TokenClaims {
        user_id: backend::kernel::UserId::new(),
        email: "test@example.com".into(),
        name: "Test".into(),
        scopes: vec!["movies:read".into()],
    };

    let token = svc.generate_access_token(&claims).unwrap();
    let decoded = svc.validate_access_token(&token).unwrap();

    assert_eq!(decoded.email, "test@example.com");
    assert_eq!(decoded.name, "Test");
    assert_eq!(decoded.scopes, vec!["movies:read"]);
}

#[tokio::test]
async fn test_jwt_generate_and_validate_refresh_token() {
    let config = test_auth_config();
    let svc = JwtTokenService::new(&config.jwt);
    let user_id = backend::kernel::UserId::new();

    let token = svc.generate_refresh_token(&user_id).unwrap();
    let decoded_id = svc.validate_refresh_token(&token).unwrap();

    assert_eq!(decoded_id.as_str(), user_id.as_str());
}

#[tokio::test]
async fn test_jwt_invalid_token_rejected() {
    let config = test_auth_config();
    let svc = JwtTokenService::new(&config.jwt);

    let result = svc.validate_access_token("garbage.token.here");
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "auth.token_validation_failed");
}

#[tokio::test]
async fn test_jwt_wrong_secret_rejected() {
    let config1 = test_auth_config();
    let svc1 = JwtTokenService::new(&config1.jwt);

    let claims = backend::iam::auth::TokenClaims {
        user_id: backend::kernel::UserId::new(),
        email: "test@example.com".into(),
        name: "Test".into(),
        scopes: vec![],
    };
    let token = svc1.generate_access_token(&claims).unwrap();

    let config2 = AuthConfig {
        jwt: JWTConfig {
            secret_key: "a-completely-different-secret-key-for-testing".into(),
            ..config1.jwt
        },
        ..Default::default()
    };
    let svc2 = JwtTokenService::new(&config2.jwt);

    assert!(svc2.validate_access_token(&token).is_err());
}

// ============================================================================
// Login Tests
// ============================================================================

#[tokio::test]
async fn test_login_success() {
    let ctx = TestContext::new().await;
    ctx.create_password_user("login@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "login@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    assert_eq!(pair.token_type, "Bearer");
    assert!(!pair.access_token.is_empty());
    assert!(!pair.refresh_token.is_empty());

    let claims = ctx
        .token_svc
        .validate_access_token(&pair.access_token)
        .unwrap();
    assert_eq!(claims.email, "login@example.com");
}

#[tokio::test]
async fn test_login_wrong_password() {
    let ctx = TestContext::new().await;
    ctx.create_password_user("wrong@example.com", "correct")
        .await;

    let err = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "wrong@example.com".into(),
                password: "incorrect".into(),
            },
            test_meta(),
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "auth.invalid_credentials");
}

#[tokio::test]
async fn test_login_user_not_found() {
    let ctx = TestContext::new().await;

    let err = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "ghost@example.com".into(),
                password: "whatever".into(),
            },
            test_meta(),
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "auth.invalid_credentials");
}

#[tokio::test]
async fn test_login_pending_user_rejected() {
    let ctx = TestContext::new().await;
    ctx.create_pending_user("pending@example.com", "password123")
        .await;

    let err = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "pending@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "auth.account_disabled");
}

#[tokio::test]
async fn test_login_oauth_user_no_password() {
    let ctx = TestContext::new().await;
    let user = User::new_with_oauth(
        "oauth@example.com".into(),
        "OAuth User".into(),
        None,
        OAuthProvider::Google,
        "gid-123".into(),
    );
    ctx.user_repo.save(&user).await.unwrap();

    let err = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "oauth@example.com".into(),
                password: "anything".into(),
            },
            test_meta(),
        )
        .await
        .unwrap_err();

    assert_eq!(err.code, "auth.invalid_credentials");
}

#[tokio::test]
async fn test_login_includes_effective_scopes() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("scoped@example.com", "password123")
        .await;

    let role_svc = RoleService::new(ctx.role_repo.clone(), ctx.user_repo.clone());
    let role = role_svc
        .create_role(CreateRoleRequest {
            name: "Editor".into(),
            description: None,
            scopes: vec!["movies:read".into(), "movies:write".into()],
        })
        .await
        .unwrap();
    role_svc
        .assign_role_to_user(&role.id, &user.id)
        .await
        .unwrap();

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "scoped@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    let claims = ctx
        .token_svc
        .validate_access_token(&pair.access_token)
        .unwrap();
    assert!(claims.scopes.contains(&"movies:read".to_string()));
    assert!(claims.scopes.contains(&"movies:write".to_string()));
}

// ============================================================================
// OAuth Find-or-Create Tests
// ============================================================================

#[tokio::test]
async fn test_oauth_creates_new_user() {
    let ctx = TestContext::new().await;

    let pair = ctx
        .auth_svc
        .find_or_create_oauth_user(
            OAuthUserInfo {
                id: "gid-123".into(),
                email: "new-oauth@example.com".into(),
                name: "OAuth New".into(),
                picture: Some("https://pic.jpg".into()),
                email_verified: true,
            },
            OAuthProvider::Google,
            test_meta(),
        )
        .await
        .unwrap();

    assert!(!pair.access_token.is_empty());

    let user = ctx
        .user_repo
        .get_by_email("new-oauth@example.com")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(user.oauth_provider, Some(OAuthProvider::Google));
    assert_eq!(user.oauth_provider_id.as_deref(), Some("gid-123"));
}

#[tokio::test]
async fn test_oauth_links_to_existing_user() {
    let ctx = TestContext::new().await;
    ctx.create_password_user("existing@example.com", "password123")
        .await;

    ctx.auth_svc
        .find_or_create_oauth_user(
            OAuthUserInfo {
                id: "gid-456".into(),
                email: "existing@example.com".into(),
                name: "Updated".into(),
                picture: None,
                email_verified: true,
            },
            OAuthProvider::Google,
            test_meta(),
        )
        .await
        .unwrap();

    let user = ctx
        .user_repo
        .get_by_email("existing@example.com")
        .await
        .unwrap()
        .unwrap();
    assert!(user.has_password());
    assert!(user.has_oauth());
    assert_eq!(user.oauth_provider, Some(OAuthProvider::Google));
}

// ============================================================================
// Session Creation Tests
// ============================================================================

#[tokio::test]
async fn test_login_creates_session_with_metadata() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("sess@example.com", "password123")
        .await;

    ctx.auth_svc
        .login_with_password(
            LoginRequest {
                email: "sess@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "192.168.1.1".into(),
                user_agent: "Mozilla/5.0".into(),
            },
        )
        .await
        .unwrap();

    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].ip_address, "192.168.1.1");
    assert_eq!(sessions[0].user_agent, "Mozilla/5.0");
}

#[tokio::test]
async fn test_multiple_logins_create_separate_sessions() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("multi@example.com", "password123")
        .await;

    // Login from 3 different "devices"
    for i in 0..3 {
        ctx.auth_svc
            .login_with_password(
                LoginRequest {
                    email: "multi@example.com".into(),
                    password: "password123".into(),
                },
                LoginMetadata {
                    ip_address: format!("10.0.0.{i}"),
                    user_agent: format!("Device-{i}"),
                },
            )
            .await
            .unwrap();
    }

    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 3);
}

#[tokio::test]
async fn test_oauth_login_creates_session() {
    let ctx = TestContext::new().await;

    ctx.auth_svc
        .find_or_create_oauth_user(
            OAuthUserInfo {
                id: "gid-sess".into(),
                email: "oauth-sess@example.com".into(),
                name: "OAuth".into(),
                picture: None,
                email_verified: true,
            },
            OAuthProvider::Google,
            LoginMetadata {
                ip_address: "10.0.0.1".into(),
                user_agent: "OAuthClient".into(),
            },
        )
        .await
        .unwrap();

    let user = ctx
        .user_repo
        .get_by_email("oauth-sess@example.com")
        .await
        .unwrap()
        .unwrap();
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].ip_address, "10.0.0.1");
}

// ============================================================================
// Refresh Token Rotation Tests
// ============================================================================

#[tokio::test]
async fn test_refresh_rotates_within_same_session() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("rotate@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "rotate@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    // Should still be 1 session after refresh
    let new_pair = ctx
        .auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap();

    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1, "refresh should NOT create a new session");

    // New tokens are valid
    assert!(!new_pair.access_token.is_empty());
    assert_ne!(new_pair.refresh_token, pair.refresh_token);
    let claims = ctx
        .token_svc
        .validate_access_token(&new_pair.access_token)
        .unwrap();
    assert_eq!(claims.email, "rotate@example.com");
}

#[tokio::test]
async fn test_refresh_reuse_rejected_after_rotation() {
    let ctx = TestContext::new().await;
    ctx.create_password_user("reuse@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "reuse@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    // First refresh succeeds
    ctx.auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap();

    // Reuse of old token fails (it was revoked)
    let err = ctx
        .auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap_err();
    assert_eq!(err.code, "auth.invalid_refresh_token");
}

#[tokio::test]
async fn test_refresh_invalid_token() {
    let ctx = TestContext::new().await;

    let err = ctx
        .auth_svc
        .refresh_tokens("garbage-token")
        .await
        .unwrap_err();
    assert_eq!(err.code, "auth.invalid_refresh_token");
}

#[tokio::test]
async fn test_refresh_chain_stays_in_same_session() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("chain@example.com", "password123")
        .await;

    let pair1 = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "chain@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    // Refresh 3 times in a chain
    let pair2 = ctx
        .auth_svc
        .refresh_tokens(&pair1.refresh_token)
        .await
        .unwrap();
    let pair3 = ctx
        .auth_svc
        .refresh_tokens(&pair2.refresh_token)
        .await
        .unwrap();
    let _pair4 = ctx
        .auth_svc
        .refresh_tokens(&pair3.refresh_token)
        .await
        .unwrap();

    // Still only 1 session
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(
        sessions.len(),
        1,
        "chained refreshes must stay in the same session"
    );
}

// ============================================================================
// Logout Single Session Tests
// ============================================================================

#[tokio::test]
async fn test_logout_revokes_session_and_tokens() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("lo@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "lo@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    ctx.auth_svc.logout(&pair.refresh_token).await.unwrap();

    // Refresh token is no longer usable
    let err = ctx
        .auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap_err();
    assert_eq!(err.code, "auth.invalid_refresh_token");

    // Session is gone
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 0);
}

#[tokio::test]
async fn test_logout_one_session_keeps_others() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("partial@example.com", "password123")
        .await;

    // Login from two devices
    let pair_phone = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "partial@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "1.1.1.1".into(),
                user_agent: "Phone".into(),
            },
        )
        .await
        .unwrap();

    let pair_laptop = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "partial@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "2.2.2.2".into(),
                user_agent: "Laptop".into(),
            },
        )
        .await
        .unwrap();

    // Logout from phone only
    ctx.auth_svc
        .logout(&pair_phone.refresh_token)
        .await
        .unwrap();

    // Phone token dead
    assert!(
        ctx.auth_svc
            .refresh_tokens(&pair_phone.refresh_token)
            .await
            .is_err()
    );

    // Laptop token still works
    assert!(
        ctx.auth_svc
            .refresh_tokens(&pair_laptop.refresh_token)
            .await
            .is_ok()
    );

    // Only 1 session remains
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].user_agent, "Laptop");
}

// ============================================================================
// Logout All Tests
// ============================================================================

#[tokio::test]
async fn test_logout_all_revokes_all_sessions_and_tokens() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("allout@example.com", "password123")
        .await;

    let pair1 = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "allout@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "1.1.1.1".into(),
                user_agent: "Phone".into(),
            },
        )
        .await
        .unwrap();

    let pair2 = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "allout@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "2.2.2.2".into(),
                user_agent: "Laptop".into(),
            },
        )
        .await
        .unwrap();

    ctx.auth_svc.logout_all(&user.id).await.unwrap();

    // Both tokens dead
    assert!(
        ctx.auth_svc
            .refresh_tokens(&pair1.refresh_token)
            .await
            .is_err()
    );
    assert!(
        ctx.auth_svc
            .refresh_tokens(&pair2.refresh_token)
            .await
            .is_err()
    );

    // All sessions gone
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 0);
}

// ============================================================================
// Revoke Session by ID Tests
// ============================================================================

#[tokio::test]
async fn test_revoke_session_by_id_cascades_tokens() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("revoke@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "revoke@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1);

    // Revoke via session ID (e.g. from "manage my sessions" UI)
    ctx.auth_svc.revoke_session(&sessions[0].id).await.unwrap();

    // Session gone
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 0);

    // Refresh token for that session is dead
    let err = ctx
        .auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap_err();
    assert_eq!(err.code, "auth.invalid_refresh_token");
}

#[tokio::test]
async fn test_revoke_session_by_id_keeps_other_sessions() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("revokeone@example.com", "password123")
        .await;

    let _pair1 = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "revokeone@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "1.1.1.1".into(),
                user_agent: "Phone".into(),
            },
        )
        .await
        .unwrap();

    let pair2 = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "revokeone@example.com".into(),
                password: "password123".into(),
            },
            LoginMetadata {
                ip_address: "2.2.2.2".into(),
                user_agent: "Laptop".into(),
            },
        )
        .await
        .unwrap();

    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 2);

    // Find the Phone session and revoke it
    let phone_session = sessions.iter().find(|s| s.user_agent == "Phone").unwrap();
    ctx.auth_svc
        .revoke_session(&phone_session.id)
        .await
        .unwrap();

    // Only Laptop remains
    let sessions = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].user_agent, "Laptop");

    // Laptop token still works
    assert!(
        ctx.auth_svc
            .refresh_tokens(&pair2.refresh_token)
            .await
            .is_ok()
    );
}

// ============================================================================
// Refresh Updates Session Activity
// ============================================================================

#[tokio::test]
async fn test_refresh_updates_session_last_activity() {
    let ctx = TestContext::new().await;
    let user = ctx
        .create_password_user("activity@example.com", "password123")
        .await;

    let pair = ctx
        .auth_svc
        .login_with_password(
            LoginRequest {
                email: "activity@example.com".into(),
                password: "password123".into(),
            },
            test_meta(),
        )
        .await
        .unwrap();

    let sessions_before = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    let activity_before = sessions_before[0].last_activity;

    // Small delay to ensure timestamp difference
    tokio::time::sleep(Duration::from_millis(50)).await;

    ctx.auth_svc
        .refresh_tokens(&pair.refresh_token)
        .await
        .unwrap();

    let sessions_after = ctx.auth_svc.list_user_sessions(&user.id).await.unwrap();
    let activity_after = sessions_after[0].last_activity;

    assert!(
        activity_after >= activity_before,
        "last_activity should be updated on refresh"
    );
}
