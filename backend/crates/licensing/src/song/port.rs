use async_trait::async_trait;
use errx::AppResult;
use kernel::{PageQuery, SongId, TenantId};

use super::{Song, SongError, SongFilter};

/// Persistence contract. Every method is constrained by `tenant_id`: a song
/// of another tenant behaves exactly like a song that does not exist. Writes
/// return `SongError` because the adapter is the one place that knows which
/// constraint failed (`IsrcTaken`, `InUse`).
#[async_trait]
pub trait SongRepository: Send + Sync {
    async fn get(&self, tenant_id: TenantId, id: SongId) -> AppResult<Option<Song>>;
    /// One page ordered by title, plus the total number of matches.
    async fn list(&self, tenant_id: TenantId, filter: &SongFilter, page: PageQuery) -> AppResult<(Vec<Song>, u64)>;
    /// `SongError::IsrcTaken` when another song of the tenant has the same ISRC.
    async fn insert(&self, song: &Song) -> Result<(), SongError>;
    /// `None` when the song does not exist in the tenant; `IsrcTaken` as in `insert`.
    async fn update(&self, song: &Song) -> Result<Option<Song>, SongError>;
    /// `true` when a row was removed; `SongError::InUse` while tracks still reference it.
    async fn delete(&self, tenant_id: TenantId, id: SongId) -> Result<bool, SongError>;
}
