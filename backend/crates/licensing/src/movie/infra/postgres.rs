use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{MovieId, PageQuery, TenantId};
use sqlx::PgPool;

use crate::db::like_pattern;
use crate::license::ACTIVE_STATES_SQL;
use crate::movie::port::MovieRepository;
use crate::movie::{Movie, MovieFilter, MovieStatus};

const COLUMNS: &str = "id, tenant_id, title, synopsis, release_year, status, created_at, updated_at";

/// Shared `WHERE` clause for listing: `$1` tenant, `$2` optional ILIKE pattern, `$3` optional status.
const FILTER: &str = "tenant_id = $1 AND ($2::text IS NULL OR title ILIKE $2) AND ($3::text IS NULL OR status = $3)";

#[derive(sqlx::FromRow)]
struct MovieRow {
    id: MovieId,
    tenant_id: TenantId,
    title: String,
    synopsis: Option<String>,
    release_year: Option<i32>,
    status: MovieStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<MovieRow> for Movie {
    fn from(r: MovieRow) -> Self {
        Movie {
            id: r.id,
            tenant_id: r.tenant_id,
            title: r.title,
            synopsis: r.synopsis,
            release_year: r.release_year,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresMovieRepository {
    pool: PgPool,
}

impl PostgresMovieRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MovieRepository for PostgresMovieRepository {
    async fn get(&self, tenant_id: TenantId, id: MovieId) -> AppResult<Option<Movie>> {
        let row = sqlx::query_as::<_, MovieRow>(&format!(
            "SELECT {COLUMNS} FROM movies WHERE tenant_id = $1 AND id = $2"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn list(&self, tenant_id: TenantId, filter: &MovieFilter, page: PageQuery) -> AppResult<(Vec<Movie>, u64)> {
        let pattern = filter.term().map(like_pattern);
        let status = filter.status.map(MovieStatus::as_str);
        let rows = sqlx::query_as::<_, MovieRow>(&format!(
            "SELECT {COLUMNS} FROM movies WHERE {FILTER} ORDER BY lower(title), id LIMIT $4 OFFSET $5"
        ))
        .bind(tenant_id)
        .bind(&pattern)
        .bind(status)
        .bind(page.limit())
        .bind(page.offset())
        .fetch_all(&self.pool)
        .await?;
        let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM movies WHERE {FILTER}"))
            .bind(tenant_id)
            .bind(&pattern)
            .bind(status)
            .fetch_one(&self.pool)
            .await?;
        Ok((rows.into_iter().map(Into::into).collect(), total.max(0) as u64))
    }

    async fn insert(&self, movie: &Movie) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO movies (id, tenant_id, title, synopsis, release_year, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(movie.id)
        .bind(movie.tenant_id)
        .bind(&movie.title)
        .bind(&movie.synopsis)
        .bind(movie.release_year)
        .bind(movie.status.as_str())
        .bind(movie.created_at)
        .bind(movie.updated_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update(&self, movie: &Movie) -> AppResult<Option<Movie>> {
        let row = sqlx::query_as::<_, MovieRow>(&format!(
            "UPDATE movies SET title = $3, synopsis = $4, release_year = $5, status = $6, updated_at = $7 \
             WHERE tenant_id = $1 AND id = $2 RETURNING {COLUMNS}"
        ))
        .bind(movie.tenant_id)
        .bind(movie.id)
        .bind(&movie.title)
        .bind(&movie.synopsis)
        .bind(movie.release_year)
        .bind(movie.status.as_str())
        .bind(movie.updated_at)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn delete(&self, tenant_id: TenantId, id: MovieId) -> AppResult<bool> {
        // Not while a track of one of its scenes has an active license: the
        // service checks first, the statement makes the check atomic with
        // the write.
        let result = sqlx::query(&format!(
            "DELETE FROM movies WHERE tenant_id = $1 AND id = $2 AND NOT EXISTS \
             (SELECT 1 FROM tracks t JOIN scenes s ON s.id = t.scene_id JOIN licenses l ON l.track_id = t.id \
              WHERE s.movie_id = movies.id AND l.state IN {ACTIVE_STATES_SQL})"
        ))
        .bind(tenant_id)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }
}
