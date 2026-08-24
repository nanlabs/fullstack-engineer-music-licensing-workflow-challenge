//! Read-only queries over the seeded catalog.
//!
//! Each listing has a cursored and an uncursored variant rather than one query
//! with `($1 IS NULL OR ...)`: the split keeps every statement a plain keyset
//! range scan that the planner can serve straight from the sort-key index.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::catalog::{Movie, Scene, Song};

/// Fetches movies ordered by `(created_at, id)`.
///
/// `limit` is the caller's page size plus one lookahead row.
pub async fn list_movies(
    pool: &PgPool,
    after: Option<(DateTime<Utc>, Uuid)>,
    limit: i64,
) -> Result<Vec<Movie>, sqlx::Error> {
    match after {
        None => {
            sqlx::query_as!(
                Movie,
                r#"SELECT id, title, created_at
                   FROM movies
                   ORDER BY created_at, id
                   LIMIT $1"#,
                limit,
            )
            .fetch_all(pool)
            .await
        }
        Some((created_at, id)) => {
            sqlx::query_as!(
                Movie,
                r#"SELECT id, title, created_at
                   FROM movies
                   WHERE (created_at, id) > ($1, $2)
                   ORDER BY created_at, id
                   LIMIT $3"#,
                created_at,
                id,
                limit,
            )
            .fetch_all(pool)
            .await
        }
    }
}

pub async fn movie_exists(pool: &PgPool, movie_id: Uuid) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1) AS "exists!""#,
        movie_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

/// Fetches a movie's scenes in story order, `(sequence_number, id)`.
pub async fn list_scenes(
    pool: &PgPool,
    movie_id: Uuid,
    after: Option<(i32, Uuid)>,
    limit: i64,
) -> Result<Vec<Scene>, sqlx::Error> {
    match after {
        None => {
            sqlx::query_as!(
                Scene,
                r#"SELECT id, movie_id, sequence_number, title, duration_ms
                   FROM scenes
                   WHERE movie_id = $1
                   ORDER BY sequence_number, id
                   LIMIT $2"#,
                movie_id,
                limit,
            )
            .fetch_all(pool)
            .await
        }
        Some((sequence_number, id)) => {
            sqlx::query_as!(
                Scene,
                r#"SELECT id, movie_id, sequence_number, title, duration_ms
                   FROM scenes
                   WHERE movie_id = $1 AND (sequence_number, id) > ($2, $3)
                   ORDER BY sequence_number, id
                   LIMIT $4"#,
                movie_id,
                sequence_number,
                id,
                limit,
            )
            .fetch_all(pool)
            .await
        }
    }
}

/// Fetches songs ordered by `(title, id)`, which is the order a user picking a
/// song actually wants.
pub async fn list_songs(
    pool: &PgPool,
    after: Option<(String, Uuid)>,
    limit: i64,
) -> Result<Vec<Song>, sqlx::Error> {
    match after {
        None => {
            sqlx::query_as!(
                Song,
                r#"SELECT id, title, artist_name
                   FROM songs
                   ORDER BY title, id
                   LIMIT $1"#,
                limit,
            )
            .fetch_all(pool)
            .await
        }
        Some((title, id)) => {
            sqlx::query_as!(
                Song,
                r#"SELECT id, title, artist_name
                   FROM songs
                   WHERE (title, id) > ($1, $2)
                   ORDER BY title, id
                   LIMIT $3"#,
                title,
                id,
                limit,
            )
            .fetch_all(pool)
            .await
        }
    }
}
