//! Scenes: the ordered segments of a movie that need music.
//!
//! Child entity of `movie`. The collection lives under
//! `/movies/{movie_id}/scenes`, the item under `/scenes/{id}`. The server owns
//! `position` (append on create, bulk reorder) so the uniqueness invariant has
//! a single writer. The optional window must keep containing the tracks
//! already placed in the scene (`track` checks the other direction).
//! `docs/licensing.md` records the research behind the shape.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{MovieId, SceneId, TenantId, TrackId};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::movie::MovieError;

#[derive(Debug, Clone)]
pub struct Scene {
    pub id: SceneId,
    pub tenant_id: TenantId,
    pub movie_id: MovieId,
    /// 1-based order inside the movie; assigned by the server.
    pub position: i32,
    pub title: String,
    pub description: Option<String>,
    /// Optional window inside the movie, in milliseconds. Both bounds or none.
    pub start_ms: Option<i32>,
    pub end_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SceneResponse {
    pub id: SceneId,
    pub tenant_id: TenantId,
    pub movie_id: MovieId,
    pub position: i32,
    pub title: String,
    pub description: Option<String>,
    pub start_ms: Option<i32>,
    pub end_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Scene> for SceneResponse {
    fn from(s: &Scene) -> Self {
        Self {
            id: s.id,
            tenant_id: s.tenant_id,
            movie_id: s.movie_id,
            position: s.position,
            title: s.title.clone(),
            description: s.description.clone(),
            start_ms: s.start_ms,
            end_ms: s.end_ms,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

/// Not paginated: a movie has tens of scenes and the UI needs all of them in order.
#[derive(Debug, Clone, Serialize)]
pub struct SceneList {
    pub items: Vec<SceneResponse>,
    pub count: usize,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateSceneRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[validate(range(min = 0))]
    pub start_ms: Option<i32>,
    #[validate(range(min = 0))]
    pub end_ms: Option<i32>,
}

/// Partial update. Absent fields keep their value; `"description": ""` clears
/// the text and `"start_ms": null, "end_ms": null` clear the window.
/// `position` is not editable here: use the reorder endpoint.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSceneRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    #[validate(length(max = 2000))]
    pub description: Option<String>,
    #[serde(default, deserialize_with = "kernel::json::double_option")]
    pub start_ms: Option<Option<i32>>,
    #[serde(default, deserialize_with = "kernel::json::double_option")]
    pub end_ms: Option<Option<i32>>,
}

/// Body of `PUT /movies/{movie_id}/scenes/order`.
#[derive(Debug, Deserialize, Validate)]
pub struct ReorderScenesRequest {
    /// Every scene of the movie exactly once, in the desired order.
    #[validate(length(min = 1))]
    pub scene_ids: Vec<SceneId>,
}

/// Validates the optional window: both bounds or none, non-negative, start before end.
pub fn check_window(start_ms: Option<i32>, end_ms: Option<i32>) -> Result<(), AppError> {
    match (start_ms, end_ms) {
        (None, None) => Ok(()),
        (Some(_), None) | (None, Some(_)) => {
            Err(AppError::validation("start_ms and end_ms must be given together").detail("field", "end_ms"))
        }
        (Some(start), Some(end)) => {
            if start < 0 || end < 0 {
                return Err(AppError::validation("Timecodes cannot be negative").detail("field", "start_ms"));
            }
            if start >= end {
                return Err(AppError::validation("start_ms must be before end_ms").detail("field", "end_ms"));
            }
            Ok(())
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SceneError {
    #[error("Scene not found")]
    NotFound,
    /// Narrowing the window would leave these tracks outside it.
    #[error("The new window leaves tracks outside it; move them first")]
    WindowConflict(Vec<TrackId>),
    /// Deleting the scene would remove these tracks, whose license is
    /// active (`requested`, `negotiating` or `approved`).
    #[error("The scene has tracks with an active license; reject or expire them before deleting it")]
    HasActiveLicenses(Vec<TrackId>),
    #[error(transparent)]
    Movie(#[from] MovieError),
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<SceneError> for AppError {
    fn from(err: SceneError) -> Self {
        match err {
            SceneError::NotFound => AppError::not_found("SCENE_NOT_FOUND", err.to_string()),
            SceneError::WindowConflict(ref ids) => {
                let ids = ids.clone();
                AppError::conflict("SCENE_WINDOW_CONFLICT", err.to_string()).detail("track_ids", ids)
            }
            SceneError::HasActiveLicenses(ref ids) => {
                let ids = ids.clone();
                AppError::conflict("SCENE_HAS_ACTIVE_LICENSES", err.to_string()).detail("track_ids", ids)
            }
            SceneError::Movie(inner) => inner.into(),
            SceneError::App(inner) => inner,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::check_window;

    #[test]
    fn window_rules() {
        assert!(check_window(None, None).is_ok());
        assert!(check_window(Some(0), Some(1)).is_ok());
        assert_eq!(check_window(Some(1), None).unwrap_err().details()["field"], "end_ms");
        assert_eq!(check_window(None, Some(1)).unwrap_err().details()["field"], "end_ms");
        assert_eq!(
            check_window(Some(-1), Some(1)).unwrap_err().details()["field"],
            "start_ms"
        );
        assert_eq!(check_window(Some(5), Some(5)).unwrap_err().details()["field"], "end_ms");
        assert_eq!(check_window(Some(6), Some(5)).unwrap_err().details()["field"], "end_ms");
    }
}
