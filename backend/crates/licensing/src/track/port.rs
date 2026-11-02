use async_trait::async_trait;
use errx::AppResult;
use kernel::{MovieId, SceneId, TenantId, TrackId};

use super::{Track, TrackError, TrackView};
use crate::license::LicenseState;

/// Persistence contract. Every method is constrained by `tenant_id`; reads
/// return the [`TrackView`] (movie, song summary and license joined in).
/// Writes return `TrackError` because the adapter is the one place that
/// knows which foreign key failed (`UnknownSong`).
#[async_trait]
pub trait TrackRepository: Send + Sync {
    async fn get(&self, tenant_id: TenantId, id: TrackId) -> AppResult<Option<TrackView>>;
    /// Every track of the scene ordered by `start_ms`, optionally only those
    /// whose license is in `state`.
    async fn list_by_scene(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>>;
    /// Every track of every scene of the movie, ordered by scene position
    /// and then `start_ms`; same optional state filter.
    async fn list_by_movie(
        &self,
        tenant_id: TenantId,
        movie_id: MovieId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>>;
    /// Inserts the track and its `pending` license together.
    /// `TrackError::UnknownSong` when `song_id` is not a song of the tenant.
    async fn insert(&self, track: &Track) -> Result<TrackView, TrackError>;
    /// `None` when the track does not exist in the tenant *or its license is
    /// active*: the guard is part of the statement, so a transition that
    /// commits between the service's check and the write still wins.
    /// `UnknownSong` as in `insert`.
    async fn update(&self, track: &Track) -> Result<Option<TrackView>, TrackError>;
    /// `true` when a row was removed (its license and events go with it);
    /// `false` when there is none or its license is active, as in `update`.
    async fn delete(&self, tenant_id: TenantId, id: TrackId) -> AppResult<bool>;
    /// Ids of the scene's tracks whose license is active (`requested`,
    /// `negotiating` or `approved`), ordered by `start_ms`: what blocks
    /// deleting the scene.
    async fn locked_in_scene(&self, tenant_id: TenantId, scene_id: SceneId) -> AppResult<Vec<TrackId>>;
    /// The same across every scene of the movie, ordered by scene position
    /// and then `start_ms`: what blocks deleting the movie.
    async fn locked_in_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<TrackId>>;
    /// Ids of the scene's tracks that would not fit in `[start_ms, end_ms]`,
    /// ordered by `start_ms`; used before a scene narrows its window.
    async fn outside_window(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        start_ms: i32,
        end_ms: i32,
    ) -> AppResult<Vec<TrackId>>;
}
