use async_trait::async_trait;
use errx::AppResult;
use kernel::{MovieId, PageQuery, TenantId};

use super::{Movie, MovieFilter};

/// Persistence contract. Every method is constrained by `tenant_id`: a movie
/// of another tenant behaves exactly like a movie that does not exist.
#[async_trait]
pub trait MovieRepository: Send + Sync {
    async fn get(&self, tenant_id: TenantId, id: MovieId) -> AppResult<Option<Movie>>;
    /// One page ordered by title, plus the total number of matches.
    async fn list(&self, tenant_id: TenantId, filter: &MovieFilter, page: PageQuery) -> AppResult<(Vec<Movie>, u64)>;
    async fn insert(&self, movie: &Movie) -> AppResult<()>;
    /// `None` when the movie does not exist in the tenant.
    async fn update(&self, movie: &Movie) -> AppResult<Option<Movie>>;
    /// `true` when a row was removed (its scenes and tracks go with it);
    /// `false` when there is none *or a track in one of its scenes has an
    /// active license*: the guard is part of the statement, so a transition
    /// that commits between the service's check and the write still wins.
    async fn delete(&self, tenant_id: TenantId, id: MovieId) -> AppResult<bool>;
}
