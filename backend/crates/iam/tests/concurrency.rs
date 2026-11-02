//! Races that only a real PostgreSQL reproduces. Each test parks the two
//! competing requests on a row lock held by a side transaction, waits in
//! `pg_stat_activity` until both are blocked, then releases the lock so they
//! hit the database in the same instant. Run with:
//!
//! ```text
//! DATABASE_URL=postgres://licensing:licensing@localhost:5432/licensing \
//!   cargo test -p iam -- --include-ignored
//! ```

use std::sync::Arc;
use std::time::Duration;

use actix_web::http::StatusCode;
use actix_web::{test, web, App};
use iam::auth::session::hash_refresh_token;
use iam::auth::{AuthError, ClientInfo};
use iam::testing::{call, get_as, login_with_otp, Outbox, ACME_ADMIN_EMAIL, ACME_TENANT};
use iam::{Container, Deps, IamConfig};
use sqlx::PgPool;

/// The statement `RefreshTokenRepository::revoke_by_hash` runs; both racing
/// requests block on it while the gate transaction holds the row.
const CONSUME_SQL_PREFIX: &str = "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash%";

fn client(user_agent: &str) -> ClientInfo {
    ClientInfo {
        ip_address: "127.0.0.1".into(),
        user_agent: user_agent.into(),
    }
}

/// Polls until `expected` backends of this database wait on a lock inside
/// the refresh token consume.
async fn wait_until_blocked(pool: &PgPool, expected: i64) {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let blocked: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM pg_stat_activity \
                 WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE $1",
            )
            .bind(CONSUME_SQL_PREFIX)
            .fetch_one(pool)
            .await
            .unwrap();
            if blocked == expected {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("both refresh calls should reach the token consume");
}

/// Two requests present the same refresh token at the same time. Exactly one
/// gets new tokens; the other is treated as a replay and ends the session, so
/// even the winner's tokens stop working (RFC 9700 §4.14.2).
#[sqlx::test(migrations = "../../migrations")]
#[ignore = "needs DATABASE_URL; run with `cargo test -p iam -- --include-ignored`"]
async fn concurrent_refresh_consumes_the_token_once_and_ends_the_session(pool: PgPool) {
    let outbox = Arc::new(Outbox::default());
    let container = Container::new(Deps {
        pool: pool.clone(),
        config: IamConfig::development("test-secret-that-is-long-enough-for-hs256!!"),
        otp_notifier: outbox.clone(),
        invitation_notifier: outbox.clone(),
    });
    let app =
        test::init_service(App::new().service(web::scope("/api/v1").configure(|cfg| container.configure(cfg)))).await;
    let tokens = login_with_otp(&app, &outbox, ACME_ADMIN_EMAIL, ACME_TENANT).await;
    let presented = hash_refresh_token(&tokens.refresh_token);
    let session_id: uuid::Uuid = sqlx::query_scalar("SELECT session_id FROM refresh_tokens WHERE token_hash = $1")
        .bind(&presented)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Gate: hold the token row so both refreshes pass every check and queue
    // on the consume. Committing releases them together.
    let mut gate = pool.begin().await.unwrap();
    sqlx::query("SELECT id FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE")
        .bind(&presented)
        .fetch_one(&mut *gate)
        .await
        .unwrap();

    let auth = container.auth_service.clone();
    let refresh = |agent: &'static str| {
        let auth = auth.clone();
        let token = tokens.refresh_token.clone();
        async move { auth.refresh(&token, &client(agent)).await }
    };
    let (first, second, ()) = tokio::join!(refresh("first"), refresh("second"), async {
        wait_until_blocked(&pool, 2).await;
        gate.commit().await.unwrap();
    });

    let (winner, loser) = match (first, second) {
        (Ok(w), Err(l)) | (Err(l), Ok(w)) => (w, l),
        (Ok(_), Ok(_)) => panic!("both requests refreshed with the same token"),
        (Err(a), Err(b)) => panic!("neither request refreshed: {a:?} / {b:?}"),
    };
    assert!(matches!(loser, AuthError::InvalidRefreshToken), "{loser:?}");

    // The loser ended the session; nothing issued to the winner survives.
    let session_revoked: bool = sqlx::query_scalar("SELECT revoked_at IS NOT NULL FROM sessions WHERE id = $1")
        .bind(session_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        session_revoked,
        "the session should be revoked after a concurrent consume"
    );

    let r = call(&app, get_as("/api/v1/auth/me", &winner.access_token).to_request()).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{}", r.body);

    // Whether the winner's token was issued before or after the session
    // revoke, presenting it fails and leaves no live token behind.
    let err = auth.refresh(&winner.refresh_token, &client("third")).await.unwrap_err();
    assert!(
        matches!(err, AuthError::InvalidRefreshToken | AuthError::SessionExpired),
        "{err:?}"
    );
    let live: i64 =
        sqlx::query_scalar("SELECT count(*) FROM refresh_tokens WHERE session_id = $1 AND revoked_at IS NULL")
            .bind(session_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(live, 0);
}
