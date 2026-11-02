//! Root composition. Owns shared infrastructure (the Postgres pool) and
//! composes bounded-context containers. This is the only place that knows
//! about every module.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use notifx::{ConsoleEmailSender, EmailSender, InvitationMailer, OtpMailer, Provider};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::config::AppConfig;

pub struct Container {
    pub config: AppConfig,
    pub pool: PgPool,
    pub iam: iam::Container,
    pub licensing: licensing::Container,
    /// Cancelled when the process is asked to stop: background jobs end and
    /// open event streams close, so the graceful shutdown is immediate.
    pub shutdown: CancellationToken,
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

        // Delivery: one transport, one adapter per IAM notifier port.
        let sender: Arc<dyn EmailSender> = match config.notify.provider {
            Provider::Console => {
                tracing::warn!("email provider: console (messages are printed to the log; development only)");
                Arc::new(ConsoleEmailSender::new(config.notify.clone()))
            }
        };
        let iam = iam::Container::new(iam::Deps {
            pool: pool.clone(),
            config: config.iam.clone(),
            otp_notifier: Arc::new(OtpMailer::new(sender.clone(), config.notify.clone())),
            invitation_notifier: Arc::new(InvitationMailer::new(sender, config.notify.clone())),
        });

        let redis = match &config.redis.url {
            Some(url) => {
                let client = redis::Client::open(url.as_str()).context("invalid REDIS_URL")?;
                tracing::info!("redis event fan-out enabled");
                Some(client)
            }
            None => {
                tracing::info!("in-process event bus (single instance; set REDIS_URL to fan out)");
                None
            }
        };

        let shutdown = CancellationToken::new();
        let licensing = licensing::Container::new(licensing::Deps {
            pool: pool.clone(),
            config: config.licensing.clone(),
            redis,
            shutdown: shutdown.clone(),
        });

        Ok(Arc::new(Self {
            config: config.clone(),
            pool,
            iam,
            licensing,
            shutdown,
        }))
    }

    /// Starts periodic jobs. The returned token stops them (and closes open
    /// event streams) on shutdown.
    pub fn start_background_services(&self) -> CancellationToken {
        let cancel = self.shutdown.clone();
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
