//! Movies: the catalogue entry that owns scenes.
//!
//! First module of the licensing context and the reference implementation of
//! the module shape described in `docs/architecture.md`: entity and DTOs here,
//! required contracts in `port.rs`, use cases in `service.rs`, the Postgres
//! adapter in `infra/` and the HTTP transport in `api/`.

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
use kernel::{MovieId, TenantId, TrackId};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Production stage of a movie. Informational: it does not gate licensing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MovieStatus {
    Draft,
    InProduction,
    Released,
    Archived,
}

impl MovieStatus {
    /// Database representation (matches the `CHECK` constraint in `0003_movies.sql`).
    pub fn as_str(self) -> &'static str {
        match self {
            MovieStatus::Draft => "draft",
            MovieStatus::InProduction => "in_production",
            MovieStatus::Released => "released",
            MovieStatus::Archived => "archived",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Movie {
    pub id: MovieId,
    pub tenant_id: TenantId,
    pub title: String,
    pub synopsis: Option<String>,
    pub release_year: Option<i32>,
    pub status: MovieStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MovieResponse {
    pub id: MovieId,
    pub tenant_id: TenantId,
    pub title: String,
    pub synopsis: Option<String>,
    pub release_year: Option<i32>,
    pub status: MovieStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Movie> for MovieResponse {
    fn from(m: &Movie) -> Self {
        Self {
            id: m.id,
            tenant_id: m.tenant_id,
            title: m.title.clone(),
            synopsis: m.synopsis.clone(),
            release_year: m.release_year,
            status: m.status,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

/// First movie ever (1888) up to a generous horizon; mirrored by the database `CHECK`.
pub const MIN_RELEASE_YEAR: i32 = 1888;
pub const MAX_RELEASE_YEAR: i32 = 2100;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateMovieRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    #[validate(length(max = 2000))]
    pub synopsis: Option<String>,
    #[validate(range(min = 1888, max = 2100))]
    pub release_year: Option<i32>,
    /// Defaults to `draft`.
    pub status: Option<MovieStatus>,
}

/// Partial update: absent fields keep their value. An empty `synopsis` clears it.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateMovieRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    #[validate(length(max = 2000))]
    pub synopsis: Option<String>,
    #[validate(range(min = 1888, max = 2100))]
    pub release_year: Option<i32>,
    pub status: Option<MovieStatus>,
}

/// Query-string filters for `GET /movies`.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MovieFilter {
    /// Case-insensitive substring match on the title.
    pub q: Option<String>,
    pub status: Option<MovieStatus>,
}

impl MovieFilter {
    /// Trimmed search term, `None` when blank.
    pub fn term(&self) -> Option<&str> {
        self.q.as_deref().map(str::trim).filter(|q| !q.is_empty())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MovieError {
    #[error("Movie not found")]
    NotFound,
    /// Deleting the movie would remove these tracks, whose license is
    /// active (`requested`, `negotiating` or `approved`).
    #[error("The movie has tracks with an active license; reject or expire them before deleting it")]
    HasActiveLicenses(Vec<TrackId>),
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<MovieError> for AppError {
    fn from(err: MovieError) -> Self {
        match err {
            MovieError::NotFound => AppError::not_found("MOVIE_NOT_FOUND", err.to_string()),
            MovieError::HasActiveLicenses(ref ids) => {
                let ids = ids.clone();
                AppError::conflict("MOVIE_HAS_ACTIVE_LICENSES", err.to_string()).detail("track_ids", ids)
            }
            MovieError::App(inner) => inner,
        }
    }
}
