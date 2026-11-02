//! Adapter invariants that need a real PostgreSQL. Like every other
//! database suite, `#[sqlx::test]` creates a throwaway database from
//! `DATABASE_URL` and applies `migrations/` (seed included), so the test never
//! depends on the base database having been migrated. Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p iam -- --include-ignored
//! ```

use iam::otp::OtpPurpose;
use iam::tenant::TenantStatus;
use iam::user::UserStatus;
use sqlx::PgPool;

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p iam -- --include-ignored`"]
async fn text_backed_enums_round_trip(pool: PgPool) {
    let status: UserStatus = sqlx::query_scalar("SELECT 'suspended'::text")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, UserStatus::Suspended);

    let status: TenantStatus = sqlx::query_scalar("SELECT status FROM tenants WHERE slug = 'acme'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, TenantStatus::Active);

    let purpose: OtpPurpose = sqlx::query_scalar("SELECT $1")
        .bind(OtpPurpose::Signup)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(purpose, OtpPurpose::Signup);
}
