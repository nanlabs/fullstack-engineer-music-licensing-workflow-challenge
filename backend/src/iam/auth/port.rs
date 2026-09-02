use crate::error::AppError;
use crate::iam::user::OAuthProvider;
use crate::kernel::UserId;

use super::model::{OAuthTokenResponse, OAuthUserInfo, RefreshToken, TokenClaims, UserSession};

// ============================================================================
// Token Service (sync — JWT is pure CPU, no I/O)
// ============================================================================

pub trait TokenService: Send + Sync {
    fn generate_access_token(&self, claims: &TokenClaims) -> Result<String, AppError>;
    fn validate_access_token(&self, token: &str) -> Result<TokenClaims, AppError>;
    fn generate_refresh_token(&self, user_id: &UserId) -> Result<String, AppError>;
    fn validate_refresh_token(&self, token: &str) -> Result<UserId, AppError>;
}

// ============================================================================
// Token Repository (async — DB I/O)
// ============================================================================

#[async_trait::async_trait]
pub trait TokenRepository: Send + Sync {
    async fn save_refresh_token(&self, token: &RefreshToken) -> Result<(), AppError>;
    async fn get_refresh_token(&self, token: &str) -> Result<Option<RefreshToken>, AppError>;
    async fn revoke_refresh_token(&self, token: &str) -> Result<(), AppError>;
    async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError>;
    async fn revoke_by_session(&self, session_id: &str) -> Result<(), AppError>;
}

// ============================================================================
// Session Repository (async — DB I/O)
// ============================================================================

#[async_trait::async_trait]
pub trait SessionRepository: Send + Sync {
    async fn save(&self, session: &UserSession) -> Result<(), AppError>;
    async fn get_by_id(&self, session_id: &str) -> Result<Option<UserSession>, AppError>;
    async fn list_by_user(&self, user_id: &UserId) -> Result<Vec<UserSession>, AppError>;
    async fn update_activity(&self, session_id: &str) -> Result<(), AppError>;
    async fn revoke(&self, session_id: &str) -> Result<(), AppError>;
    async fn revoke_all_for_user(&self, user_id: &UserId) -> Result<(), AppError>;
    async fn clean_expired(&self) -> Result<(), AppError>;
}

// ============================================================================
// OAuth Service (async — external HTTP calls)
// ============================================================================

#[async_trait::async_trait]
pub trait OAuthService: Send + Sync {
    fn get_auth_url(&self, state: &str) -> String;
    async fn exchange_token(&self, code: &str) -> Result<OAuthTokenResponse, AppError>;
    async fn get_user_info(&self, access_token: &str) -> Result<OAuthUserInfo, AppError>;
    fn get_provider(&self) -> OAuthProvider;
}
