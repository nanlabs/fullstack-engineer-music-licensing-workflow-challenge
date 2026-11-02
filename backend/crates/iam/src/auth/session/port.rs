use async_trait::async_trait;
use errx::AppResult;
use kernel::{SessionId, UserId};

use super::{RefreshToken, Session};

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn insert(&self, session: &Session) -> AppResult<()>;
    async fn get(&self, id: SessionId) -> AppResult<Option<Session>>;
    async fn list_active_by_user(&self, user_id: UserId) -> AppResult<Vec<Session>>;
    async fn count_active(&self, user_id: UserId) -> AppResult<i64>;
    async fn oldest_active(&self, user_id: UserId) -> AppResult<Option<Session>>;
    async fn touch(&self, id: SessionId) -> AppResult<()>;
    async fn revoke(&self, id: SessionId) -> AppResult<bool>;
    async fn revoke_all_by_user(&self, user_id: UserId) -> AppResult<u64>;
    async fn delete_expired(&self) -> AppResult<u64>;
}

#[async_trait]
pub trait RefreshTokenRepository: Send + Sync {
    async fn insert(&self, token: &RefreshToken) -> AppResult<()>;
    /// Includes revoked tokens so reuse can be detected.
    async fn get_by_hash(&self, token_hash: &[u8]) -> AppResult<Option<RefreshToken>>;
    async fn revoke_by_hash(&self, token_hash: &[u8]) -> AppResult<bool>;
    async fn revoke_by_session(&self, session_id: SessionId) -> AppResult<u64>;
    async fn revoke_all_by_user(&self, user_id: UserId) -> AppResult<u64>;
    async fn delete_expired(&self) -> AppResult<u64>;
}
