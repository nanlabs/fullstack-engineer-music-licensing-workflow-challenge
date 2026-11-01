//! Root composition. Owns shared infrastructure (the Postgres pool) and
//! composes bounded-context containers. This is the only place that knows
//! about every module.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::config::AppConfig;
use crate::notifiers::{ConsoleInvitationNotifier, ConsoleOtpNotifier};

pub struct Container {
    pub config: AppConfig,
    pub pool: PgPool,
    pub iam: iam::Container,
    pub licensing: licensing::Container,
}

impl Container {
    pub async fn build(config: &AppConfig) -> anyhow::Result<Arc<Self>> {
        tracing::info!("initializing application container");

        let pool = PgPoolOptions::new()
            .max_connections(config.database.max_connections)
            .acquire_timeout(config.database.acquire_timeout)
            .connect(&config.database.url)
            .await
            .context("failed to connect to PostgreSQL")?;
        tracing::info!("database connected");

        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await
            .context("failed to run database migrations")?;
        tracing::info!("database migrations applied");

        let iam = iam::Container::new(iam::Deps {
            pool: pool.clone(),
            config: config.iam.clone(),
            otp_notifier: Arc::new(ConsoleOtpNotifier),
            invitation_notifier: Arc::new(ConsoleInvitationNotifier),
        });
        tracing::warn!("OTP codes and invitation tokens are delivered to the console (development only)");

        let licensing = licensing::Container::new(licensing::Deps { pool: pool.clone() });

        Ok(Arc::new(Self {
            config: config.clone(),
            pool,
            iam,
            licensing,
        }))
    }

    /// Starts periodic jobs. The returned token stops them on shutdown.
    pub fn start_background_services(&self) -> CancellationToken {
        let cancel = CancellationToken::new();
        self.iam.spawn_background(cancel.clone());
        self.licensing.spawn_background(cancel.clone());
        cancel
    }

    pub async fn shutdown(&self) {
        tracing::info!("closing database pool");
        tokio::time::timeout(Duration::from_secs(5), self.pool.close())
            .await
            .ok();
    }
}
