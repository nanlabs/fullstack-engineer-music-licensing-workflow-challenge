use async_trait::async_trait;
use errx::AppResult;
use kernel::{MovieId, SceneId, TenantId};

use super::Scene;

/// Persistence contract. Every method is constrained by `tenant_id`; the
/// movie row is locked while positions are written so concurrent appends and
/// reorders on the same movie are serialized.
#[async_trait]
pub trait SceneRepository: Send + Sync {
    async fn get(&self, tenant_id: TenantId, id: SceneId) -> AppResult<Option<Scene>>;
    /// Every scene of the movie ordered by `position`.
    async fn list_by_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<Scene>>;
    /// Appends the scene at the end of its movie (`scene.position` is ignored)
    /// and returns the stored row; `None` when the movie does not exist in the tenant.
    async fn insert(&self, scene: &Scene) -> AppResult<Option<Scene>>;
    /// Updates everything but `position`; `None` when the scene does not exist.
    async fn update(&self, scene: &Scene) -> AppResult<Option<Scene>>;
    /// `true` when a row was removed (its tracks go with it); `false` when
    /// there is none *or one of its tracks has an active license*: the guard
    /// is part of the statement, so a transition that commits between the
    /// service's check and the write still wins.
    async fn delete(&self, tenant_id: TenantId, id: SceneId) -> AppResult<bool>;
    /// Assigns positions `1..=n` following `ids`, which must be exactly the
    /// scenes of the movie (the service checks; the adapter re-checks under
    /// the lock and fails with `SCENE_ORDER_STALE`). `None` when the movie
    /// does not exist in the tenant.
    async fn reorder(&self, tenant_id: TenantId, movie_id: MovieId, ids: &[SceneId]) -> AppResult<Option<Vec<Scene>>>;
}
