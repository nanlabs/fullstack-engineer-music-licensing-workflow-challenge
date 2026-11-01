use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::AppResult;
use kernel::OtpId;
use sqlx::PgPool;

use crate::otp::port::OtpRepository;
use crate::otp::{Otp, OtpPurpose};

pub const OTP_COLUMNS: &str =
    "id, contact::text AS contact, code_hash, purpose, expires_at, verified_at, attempts, max_attempts, created_at";

#[derive(sqlx::FromRow)]
pub struct OtpRow {
    id: OtpId,
    contact: String,
    code_hash: Vec<u8>,
    purpose: OtpPurpose,
    expires_at: DateTime<Utc>,
    verified_at: Option<DateTime<Utc>>,
    attempts: i32,
    max_attempts: i32,
    created_at: DateTime<Utc>,
}

impl From<OtpRow> for Otp {
    fn from(r: OtpRow) -> Self {
        Otp {
            id: r.id,
            contact: r.contact,
            code_hash: r.code_hash,
            purpose: r.purpose,
            expires_at: r.expires_at,
            verified_at: r.verified_at,
            attempts: r.attempts,
            max_attempts: r.max_attempts,
            created_at: r.created_at,
        }
    }
}

pub struct PostgresOtpRepository {
    pool: PgPool,
}

impl PostgresOtpRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OtpRepository for PostgresOtpRepository {
    async fn insert(&self, otp: &Otp) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO otps (id, contact, code_hash, purpose, expires_at, verified_at, attempts, max_attempts, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(otp.id)
        .bind(&otp.contact)
        .bind(&otp.code_hash)
        .bind(otp.purpose)
        .bind(otp.expires_at)
        .bind(otp.verified_at)
        .bind(otp.attempts)
        .bind(otp.max_attempts)
        .bind(otp.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn latest_by_contact(&self, contact: &str, purpose: OtpPurpose) -> AppResult<Option<Otp>> {
        let row = sqlx::query_as::<_, OtpRow>(&format!(
            "SELECT {OTP_COLUMNS} FROM otps WHERE contact = $1::citext AND purpose = $2 ORDER BY created_at DESC LIMIT 1"
        ))
        .bind(contact)
        .bind(purpose)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn record_attempt(&self, id: OtpId, verified: bool) -> AppResult<Option<Otp>> {
        let row = sqlx::query_as::<_, OtpRow>(&format!(
            "UPDATE otps SET attempts = attempts + 1, \
                             verified_at = CASE WHEN $2 THEN now() ELSE verified_at END \
             WHERE id = $1 AND verified_at IS NULL AND attempts < max_attempts \
             RETURNING {OTP_COLUMNS}"
        ))
        .bind(id)
        .bind(verified)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(Into::into))
    }

    async fn delete_expired(&self) -> AppResult<u64> {
        let result = sqlx::query("DELETE FROM otps WHERE expires_at < now()")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
