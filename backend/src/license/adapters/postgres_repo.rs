use sqlx::PgPool;

use crate::error::AppError;
use crate::kernel::{LicenseOfferId, LicenseRequestId, TrackId, UserId};

use super::super::model::{LicenseOffer, LicenseRequest, LicenseStatus, NegotiationSide};
use super::super::port::LicenseRepository;

const LICENSE_COLUMNS: &str = "id, track_id, status, requested_by, requested_at, \
    resolved_by, resolved_at, rejection_reason, created_at, updated_at";

const OFFER_COLUMNS: &str = "id, license_request_id, offer_number, side, proposed_by, \
    license_fee, currency, territory, media_rights, license_start, license_end, \
    exclusive, notes, created_at";

pub struct PostgresLicenseRepository {
    pool: PgPool,
}

impl PostgresLicenseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn license_from_row(row: &sqlx::postgres::PgRow) -> Result<LicenseRequest, AppError> {
    use sqlx::Row;
    let status_str: String = row
        .try_get("status")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let resolved_by: Option<String> = row
        .try_get("resolved_by")
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(LicenseRequest {
        id: LicenseRequestId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        track_id: TrackId::from_string(
            row.try_get("track_id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        status: LicenseStatus::try_from(status_str.as_str())?,
        requested_by: UserId::from_string(
            row.try_get("requested_by")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        requested_at: row
            .try_get("requested_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
        resolved_by: resolved_by.map(UserId::from_string),
        resolved_at: row
            .try_get("resolved_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
        rejection_reason: row
            .try_get("rejection_reason")
            .map_err(|e| AppError::internal(e.to_string()))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
    })
}

fn offer_from_row(row: &sqlx::postgres::PgRow) -> Result<LicenseOffer, AppError> {
    use sqlx::Row;
    let side_str: String = row
        .try_get("side")
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(LicenseOffer {
        id: LicenseOfferId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        license_request_id: LicenseRequestId::from_string(
            row.try_get("license_request_id")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        offer_number: row
            .try_get("offer_number")
            .map_err(|e| AppError::internal(e.to_string()))?,
        side: NegotiationSide::try_from(side_str.as_str())?,
        proposed_by: UserId::from_string(
            row.try_get("proposed_by")
                .map_err(|e| AppError::internal(e.to_string()))?,
        ),
        license_fee: row
            .try_get("license_fee")
            .map_err(|e| AppError::internal(e.to_string()))?,
        currency: row
            .try_get("currency")
            .map_err(|e| AppError::internal(e.to_string()))?,
        territory: row
            .try_get("territory")
            .map_err(|e| AppError::internal(e.to_string()))?,
        media_rights: row
            .try_get("media_rights")
            .map_err(|e| AppError::internal(e.to_string()))?,
        license_start: row
            .try_get("license_start")
            .map_err(|e| AppError::internal(e.to_string()))?,
        license_end: row
            .try_get("license_end")
            .map_err(|e| AppError::internal(e.to_string()))?,
        exclusive: row
            .try_get("exclusive")
            .map_err(|e| AppError::internal(e.to_string()))?,
        notes: row
            .try_get("notes")
            .map_err(|e| AppError::internal(e.to_string()))?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(e.to_string()))?,
    })
}

#[async_trait::async_trait]
impl LicenseRepository for PostgresLicenseRepository {
    async fn save(&self, license: &LicenseRequest) -> Result<(), AppError> {
        sqlx::query(&format!(
            "INSERT INTO license_requests ({LICENSE_COLUMNS}) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"
        ))
        .bind(license.id.as_str())
        .bind(license.track_id.as_str())
        .bind(license.status.as_str())
        .bind(license.requested_by.as_str())
        .bind(license.requested_at)
        .bind(license.resolved_by.as_ref().map(|u| u.as_str()))
        .bind(license.resolved_at)
        .bind(&license.rejection_reason)
        .bind(license.created_at)
        .bind(license.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn save_with_offer(
        &self,
        license: &LicenseRequest,
        offer: &LicenseOffer,
    ) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;

        sqlx::query(&format!(
            "INSERT INTO license_requests ({LICENSE_COLUMNS}) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"
        ))
        .bind(license.id.as_str())
        .bind(license.track_id.as_str())
        .bind(license.status.as_str())
        .bind(license.requested_by.as_str())
        .bind(license.requested_at)
        .bind(license.resolved_by.as_ref().map(|u| u.as_str()))
        .bind(license.resolved_at)
        .bind(&license.rejection_reason)
        .bind(license.created_at)
        .bind(license.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        sqlx::query(&format!(
            "INSERT INTO license_offers ({OFFER_COLUMNS}) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)"
        ))
        .bind(offer.id.as_str())
        .bind(offer.license_request_id.as_str())
        .bind(offer.offer_number)
        .bind(offer.side.as_str())
        .bind(offer.proposed_by.as_str())
        .bind(offer.license_fee)
        .bind(&offer.currency)
        .bind(&offer.territory)
        .bind(&offer.media_rights)
        .bind(offer.license_start)
        .bind(offer.license_end)
        .bind(offer.exclusive)
        .bind(&offer.notes)
        .bind(offer.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn get_by_id(&self, id: &LicenseRequestId) -> Result<Option<LicenseRequest>, AppError> {
        let row = sqlx::query(&format!(
            "SELECT {LICENSE_COLUMNS} FROM license_requests WHERE id = $1"
        ))
        .bind(id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(license_from_row).transpose()
    }

    async fn get_by_track(&self, track_id: &TrackId) -> Result<Option<LicenseRequest>, AppError> {
        let row = sqlx::query(&format!(
            "SELECT {LICENSE_COLUMNS} FROM license_requests \
             WHERE track_id = $1 AND status NOT IN ('REJECTED', 'CANCELLED') \
             ORDER BY created_at DESC LIMIT 1"
        ))
        .bind(track_id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(license_from_row).transpose()
    }

    async fn list_by_track(&self, track_id: &TrackId) -> Result<Vec<LicenseRequest>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {LICENSE_COLUMNS} FROM license_requests \
             WHERE track_id = $1 ORDER BY created_at DESC"
        ))
        .bind(track_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        rows.iter().map(license_from_row).collect()
    }

    async fn update(&self, license: &LicenseRequest) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE license_requests SET \
             status = $1, resolved_by = $2, resolved_at = $3, \
             rejection_reason = $4, updated_at = $5 \
             WHERE id = $6",
        )
        .bind(license.status.as_str())
        .bind(license.resolved_by.as_ref().map(|u| u.as_str()))
        .bind(license.resolved_at)
        .bind(&license.rejection_reason)
        .bind(license.updated_at)
        .bind(license.id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &LicenseRequestId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM license_requests WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    // Offers

    async fn save_offer(&self, offer: &LicenseOffer) -> Result<(), AppError> {
        sqlx::query(&format!(
            "INSERT INTO license_offers ({OFFER_COLUMNS}) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)"
        ))
        .bind(offer.id.as_str())
        .bind(offer.license_request_id.as_str())
        .bind(offer.offer_number)
        .bind(offer.side.as_str())
        .bind(offer.proposed_by.as_str())
        .bind(offer.license_fee)
        .bind(&offer.currency)
        .bind(&offer.territory)
        .bind(&offer.media_rights)
        .bind(offer.license_start)
        .bind(offer.license_end)
        .bind(offer.exclusive)
        .bind(&offer.notes)
        .bind(offer.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;
        Ok(())
    }

    async fn list_offers(
        &self,
        license_id: &LicenseRequestId,
    ) -> Result<Vec<LicenseOffer>, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {OFFER_COLUMNS} FROM license_offers \
             WHERE license_request_id = $1 ORDER BY offer_number ASC"
        ))
        .bind(license_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        rows.iter().map(offer_from_row).collect()
    }

    async fn get_latest_offer(
        &self,
        license_id: &LicenseRequestId,
    ) -> Result<Option<LicenseOffer>, AppError> {
        let row = sqlx::query(&format!(
            "SELECT {OFFER_COLUMNS} FROM license_offers \
             WHERE license_request_id = $1 ORDER BY offer_number DESC LIMIT 1"
        ))
        .bind(license_id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

        row.as_ref().map(offer_from_row).transpose()
    }
}
