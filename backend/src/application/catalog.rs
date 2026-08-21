//! Catalog read use cases.
//!
//! These are deliberately thin: the catalog is read-only reference data, so
//! there is no transaction to orchestrate and no invariant to enforce beyond
//! "the parent movie exists". The layer earns its place by keeping SQL out of
//! the handlers and by turning a missing parent into a domain-level outcome
//! rather than an empty list.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::catalog::{Movie, Scene, Song};
use crate::infrastructure::catalog_repository as repository;

#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
    #[error("movie {0} does not exist")]
    MovieNotFound(Uuid),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

/// Page size plus the lookahead row the pagination helper expects.
fn fetch_limit(limit: u32) -> i64 {
    i64::from(limit) + 1
}

pub async fn list_movies(
    pool: &PgPool,
    after: Option<(DateTime<Utc>, Uuid)>,
    limit: u32,
) -> Result<Vec<Movie>, CatalogError> {
    Ok(repository::list_movies(pool, after, fetch_limit(limit)).await?)
}

/// Lists a movie's scenes.
///
/// An unknown movie is reported as `MovieNotFound` rather than an empty page,
/// so clients can tell "this movie has no scenes" from "this movie does not
/// exist".
pub async fn list_scenes(
    pool: &PgPool,
    movie_id: Uuid,
    after: Option<(i32, Uuid)>,
    limit: u32,
) -> Result<Vec<Scene>, CatalogError> {
    if !repository::movie_exists(pool, movie_id).await? {
        return Err(CatalogError::MovieNotFound(movie_id));
    }

    Ok(repository::list_scenes(pool, movie_id, after, fetch_limit(limit)).await?)
}

pub async fn list_songs(
    pool: &PgPool,
    after: Option<(String, Uuid)>,
    limit: u32,
) -> Result<Vec<Song>, CatalogError> {
    Ok(repository::list_songs(pool, after, fetch_limit(limit)).await?)
}
