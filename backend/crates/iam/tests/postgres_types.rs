//! Adapter invariants that need a real PostgreSQL. Run with
//! `DATABASE_URL=... cargo test -p iam -- --include-ignored`.

use iam::otp::OtpPurpose;
use iam::tenant::TenantStatus;
use iam::user::UserStatus;
use sqlx::PgPool;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL is required for database tests");
    PgPool::connect(&url).await.expect("connect")
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn text_backed_enums_round_trip() {
    let pool = pool().await;
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
