use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::{AppError, AppResult};
use kernel::{MovieId, SceneId, TenantId};
use sqlx::{PgConnection, PgPool};

use crate::license::ACTIVE_STATES_SQL;
use crate::scene::port::SceneRepository;
use crate::scene::Scene;

const COLUMNS: &str = "id, tenant_id, movie_id, position, title, description, start_ms, end_ms, created_at, updated_at";

#[derive(sqlx::FromRow)]
struct SceneRow {
    id: SceneId,
    tenant_id: TenantId,
    movie_id: MovieId,
    position: i32,
    title: String,
    description: Option<String>,
    start_ms: Option<i32>,
    end_ms: Option<i32>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<SceneRow> for Scene {
    fn from(r: SceneRow) -> Self {
        Scene {
            id: r.id,
            tenant_id: r.tenant_id,
            movie_id: r.movie_id,
            position: r.position,
            title: r.title,
            description: r.description,
            start_ms: r.start_ms,
            end_ms: r.end_ms,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub struct PostgresSceneRepository {
    pool: PgPool,
}

impl PostgresSceneRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Locks the movie row for the rest of the transaction so appends and
/// reorders on the same movie run one at a time. `false` when the movie does
/// not exist in the tenant.
async fn lock_movie(conn: &mut PgConnection, tenant_id: TenantId, movie_id: MovieId) -> AppResult<bool> {
    let locked: Option<MovieId> =
        sqlx::query_scalar("SELECT id FROM movies WHERE tenant_id = $1 AND id = $2 FOR UPDATE")
            .bind(tenant_id)
            .bind(movie_id)
            .fetch_optional(conn)
            .await?;
    Ok(locked.is_some())
}

#[async_trait]
impl SceneRepository for PostgresSceneRepository {
    async fn get(&self, tenant_id: TenantId, id: SceneId) -> AppResult<Option<Scene>> {
        let row = sqlx::query_as::<_, SceneRow>(&format!(
            "SELECT {COLUMNS} FROM scenes WHERE tenant_id = $1 AND id = $2"
        ))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn list_by_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<Scene>> {
        let rows = sqlx::query_as::<_, SceneRow>(&format!(
            "SELECT {COLUMNS} FROM scenes WHERE tenant_id = $1 AND movie_id = $2 ORDER BY position, id"
        ))
        .bind(tenant_id)
        .bind(movie_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn insert(&self, scene: &Scene) -> AppResult<Option<Scene>> {
        let mut tx = self.pool.begin().await?;
        if !lock_movie(&mut tx, scene.tenant_id, scene.movie_id).await? {
            return Ok(None);
        }
        let row = sqlx::query_as::<_, SceneRow>(&format!(
            "INSERT INTO scenes (id, tenant_id, movie_id, position, title, description, start_ms, end_ms, \
             created_at, updated_at) \
             VALUES ($1, $2, $3, (SELECT coalesce(max(position), 0) + 1 FROM scenes WHERE movie_id = $3), \
             $4, $5, $6, $7, $8, $9) \
             RETURNING {COLUMNS}"
        ))
        .bind(scene.id)
        .bind(scene.tenant_id)
        .bind(scene.movie_id)
        .bind(&scene.title)
        .bind(&scene.description)
        .bind(scene.start_ms)
        .bind(scene.end_ms)
        .bind(scene.created_at)
        .bind(scene.updated_at)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(row.into()))
    }

    async fn update(&self, scene: &Scene) -> AppResult<Option<Scene>> {
        let row = sqlx::query_as::<_, SceneRow>(&format!(
            "UPDATE scenes SET title = $3, description = $4, start_ms = $5, end_ms = $6, updated_at = $7 \
             WHERE tenant_id = $1 AND id = $2 RETURNING {COLUMNS}"
        ))
        .bind(scene.tenant_id)
        .bind(scene.id)
        .bind(&scene.title)
        .bind(&scene.description)
        .bind(scene.start_ms)
        .bind(scene.end_ms)
        .bind(scene.updated_at)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn delete(&self, tenant_id: TenantId, id: SceneId) -> AppResult<bool> {
        // Not while a track of the scene has an active license: the service
        // checks first, the statement makes the check atomic with the write.
        let result = sqlx::query(&format!(
            "DELETE FROM scenes WHERE tenant_id = $1 AND id = $2 AND NOT EXISTS \
             (SELECT 1 FROM tracks t JOIN licenses l ON l.track_id = t.id \
              WHERE t.scene_id = scenes.id AND l.state IN {ACTIVE_STATES_SQL})"
        ))
        .bind(tenant_id)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn reorder(&self, tenant_id: TenantId, movie_id: MovieId, ids: &[SceneId]) -> AppResult<Option<Vec<Scene>>> {
        let mut tx = self.pool.begin().await?;
        if !lock_movie(&mut tx, tenant_id, movie_id).await? {
            return Ok(None);
        }
        let total: i64 = sqlx::query_scalar("SELECT count(*) FROM scenes WHERE tenant_id = $1 AND movie_id = $2")
            .bind(tenant_id)
            .bind(movie_id)
            .fetch_one(&mut *tx)
            .await?;
        let uuids: Vec<uuid::Uuid> = ids.iter().map(SceneId::as_uuid).collect();
        let positions: Vec<i32> = (1..=ids.len() as i32).collect();
        // One statement for every row; the deferred unique constraint lets
        // positions swap without a transient collision.
        let updated = sqlx::query(
            "UPDATE scenes s SET position = v.pos, updated_at = now() \
             FROM unnest($3::uuid[], $4::int[]) AS v(id, pos) \
             WHERE s.id = v.id AND s.tenant_id = $1 AND s.movie_id = $2",
        )
        .bind(tenant_id)
        .bind(movie_id)
        .bind(&uuids)
        .bind(&positions)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if total != ids.len() as i64 || updated != ids.len() as u64 {
            tx.rollback().await?;
            return Err(AppError::conflict(
                "SCENE_ORDER_STALE",
                "The scenes of this movie changed; reload and try again",
            ));
        }
        let rows = sqlx::query_as::<_, SceneRow>(&format!(
            "SELECT {COLUMNS} FROM scenes WHERE tenant_id = $1 AND movie_id = $2 ORDER BY position, id"
        ))
        .bind(tenant_id)
        .bind(movie_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(rows.into_iter().map(Into::into).collect()))
    }
}
