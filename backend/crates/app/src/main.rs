//! Application entry point. Everything here is wiring: load config, start
//! telemetry, build the container, serve HTTP, shut down cleanly.

mod config;
mod container;
mod server;
mod telemetry;

use anyhow::Context;
use tokio_util::sync::CancellationToken;

use crate::config::AppConfig;
use crate::container::Container;

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    // Load `.env` for local development; real deployments use the environment.
    let _ = dotenvy::dotenv();

    let config = AppConfig::from_env().context("invalid configuration")?;
    let telemetry = telemetry::init(&config.telemetry, &config.server)?;
    errx::expose_internal_errors(config.server.env.is_development());

    tracing::info!(
        env = %config.server.env,
        service = %config.telemetry.service_name,
        "starting music licensing backend"
    );

    let container = Container::build(&config).await?;
    let background = container.start_background_services();
    tokio::spawn(stop_on_signal(background.clone()));

    let outcome = server::run(container.clone(), &config).await;

    background.cancel();
    container.shutdown().await;
    telemetry.shutdown().await;
    outcome
}

/// Cancels `token` on SIGINT/SIGTERM so background jobs and open event
/// streams stop at once. actix runs its own graceful stop on the same
/// signal; with the streams closed it has nothing to wait for.
async fn stop_on_signal(token: CancellationToken) {
    let ctrl_c = tokio::signal::ctrl_c();
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::warn!(error = %error, "cannot listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
    tracing::info!("shutdown signal received; stopping background jobs and event streams");
    token.cancel();
}
