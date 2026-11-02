use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::{LicenseEventId, TenantId, TrackId, UserId};
use sqlx::{PgConnection, PgPool};

use crate::license::port::LicenseRepository;
use crate::license::{EventSource, License, LicenseChanged, LicenseEvent, LicenseEventKind, LicenseState};
use crate::track::infra::postgres::{TrackRow, VIEW_COLUMNS, VIEW_JOINS};
use crate::track::{TrackResponse, TrackView};

const LICENSE_COLUMNS: &str = "track_id, tenant_id, state, version, expires_at, created_at, updated_at";
const EVENT_COLUMNS: &str =
    "id, tenant_id, track_id, seq, event, from_state, to_state, source, actor_user_id, actor_name, note, created_at";

#[derive(sqlx::FromRow)]
struct LicenseRow {
    track_id: TrackId,
    tenant_id: TenantId,
    state: LicenseState,
    version: i32,
    expires_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<LicenseRow> for License {
    fn from(r: LicenseRow) -> Self {
        License {
            track_id: r.track_id,
            tenant_id: r.tenant_id,
            state: r.state,
            version: r.version,
            expires_at: r.expires_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct EventRow {
    id: LicenseEventId,
    tenant_id: TenantId,
    track_id: TrackId,
    seq: i32,
    event: LicenseEventKind,
    from_state: LicenseState,
    to_state: LicenseState,
    source: EventSource,
    actor_user_id: Option<UserId>,
    actor_name: Option<String>,
    note: Option<String>,
    created_at: DateTime<Utc>,
}

impl From<EventRow> for LicenseEvent {
    fn from(r: EventRow) -> Self {
        LicenseEvent {
            id: r.id,
            tenant_id: r.tenant_id,
            track_id: r.track_id,
            seq: r.seq,
            kind: r.event,
            from_state: r.from_state,
            to_state: r.to_state,
            source: r.source,
            actor_user_id: r.actor_user_id,
            actor_name: r.actor_name,
            note: r.note,
            created_at: r.created_at,
        }
    }
}

/// One stored event joined with the current view of its track: what the
/// stream replays. `e` is `license_events`, `t` the track of the view.
#[derive(sqlx::FromRow)]
struct ChangeRow {
    position: i64,
    event: LicenseEventKind,
    from_state: LicenseState,
    to_state: LicenseState,
    source: EventSource,
    seq: i32,
    occurred_at: DateTime<Utc>,
    #[sqlx(flatten)]
    track: TrackRow,
}

impl From<ChangeRow> for LicenseChanged {
    fn from(r: ChangeRow) -> Self {
        let view = TrackView::from(r.track);
        LicenseChanged {
            position: r.position,
            tenant_id: view.track.tenant_id,
            event: r.event,
            from_state: r.from_state,
            to_state: r.to_state,
            source: r.source,
            seq: r.seq,
            occurred_at: r.occurred_at,
            track: TrackResponse::from(&view),
        }
    }
}

/// Inserts the `pending` license of a new track. Called by the track adapter
/// inside its own transaction so a track never exists without a license.
pub(crate) async fn insert_pending(conn: &mut PgConnection, license: &License) -> sqlx::Result<()> {
    sqlx::query(&format!(
        "INSERT INTO licenses ({LICENSE_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)"
    ))
    .bind(license.track_id)
    .bind(license.tenant_id)
    .bind(license.state.as_str())
    .bind(license.version)
    .bind(license.expires_at)
    .bind(license.created_at)
    .bind(license.updated_at)
    .execute(conn)
    .await?;
    Ok(())
}

pub struct PostgresLicenseRepository {
    pool: PgPool,
}

impl PostgresLicenseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LicenseRepository for PostgresLicenseRepository {
    async fn apply(&self, license: &License, event: &LicenseEvent) -> AppResult<Option<i64>> {
        let mut tx = self.pool.begin().await?;
        // The version in the WHERE clause is the optimistic lock: a row that
        // moved since it was read is left alone and the caller sees `false`.
        let updated = sqlx::query(
            "UPDATE licenses SET state = $3, version = $4, expires_at = $5, updated_at = $6 \
             WHERE track_id = $1 AND tenant_id = $2 AND version = $4 - 1",
        )
        .bind(license.track_id)
        .bind(license.tenant_id)
        .bind(license.state.as_str())
        .bind(license.version)
        .bind(license.expires_at)
        .bind(license.updated_at)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if updated == 0 {
            tx.rollback().await?;
            return Ok(None);
        }
        // `position` is an identity column, assigned now but visible only at
        // commit. Two transitions of the same tenant could commit in the
        // opposite order of their positions and a reader of "position > N"
        // would skip one, so positions of a tenant are handed out under a
        // transaction-scoped advisory lock: the next INSERT of the tenant
        // waits for this commit and the replay cursor is exact. Other
        // tenants are not affected.
        sqlx::query("SELECT pg_advisory_xact_lock(1, hashtext($1))")
            .bind(license.tenant_id.to_string())
            .execute(&mut *tx)
            .await?;
        let position: i64 = sqlx::query_scalar(&format!(
            "INSERT INTO license_events ({EVENT_COLUMNS}) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING position"
        ))
        .bind(event.id)
        .bind(event.tenant_id)
        .bind(event.track_id)
        .bind(event.seq)
        .bind(event.kind.as_str())
        .bind(event.from_state.as_str())
        .bind(event.to_state.as_str())
        .bind(event.source.as_str())
        .bind(event.actor_user_id)
        .bind(&event.actor_name)
        .bind(&event.note)
        .bind(event.created_at)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(Some(position))
    }

    async fn list_events(&self, tenant_id: TenantId, track_id: TrackId) -> AppResult<Vec<LicenseEvent>> {
        let rows = sqlx::query_as::<_, EventRow>(&format!(
            "SELECT {EVENT_COLUMNS} FROM license_events WHERE tenant_id = $1 AND track_id = $2 ORDER BY seq"
        ))
        .bind(tenant_id)
        .bind(track_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn head_position(&self, tenant_id: TenantId) -> AppResult<i64> {
        let head: i64 =
            sqlx::query_scalar("SELECT coalesce(max(position), 0) FROM license_events WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&self.pool)
                .await?;
        Ok(head)
    }

    async fn changes_since(&self, tenant_id: TenantId, after: i64, limit: i64) -> AppResult<Vec<LicenseChanged>> {
        let rows = sqlx::query_as::<_, ChangeRow>(&format!(
            "SELECT e.position, e.event, e.from_state, e.to_state, e.source, e.seq, e.created_at AS occurred_at, \
             {VIEW_COLUMNS} FROM license_events e JOIN tracks t ON t.id = e.track_id {VIEW_JOINS} \
             WHERE e.tenant_id = $1 AND e.position > $2 ORDER BY e.position LIMIT $3"
        ))
        .bind(tenant_id)
        .bind(after)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn due_for_expiry(&self, now: DateTime<Utc>, limit: i64) -> AppResult<Vec<License>> {
        let rows = sqlx::query_as::<_, LicenseRow>(&format!(
            "SELECT {LICENSE_COLUMNS} FROM licenses \
             WHERE state = 'approved' AND expires_at IS NOT NULL AND expires_at <= $1 \
             ORDER BY expires_at, track_id LIMIT $2"
        ))
        .bind(now)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }
}
