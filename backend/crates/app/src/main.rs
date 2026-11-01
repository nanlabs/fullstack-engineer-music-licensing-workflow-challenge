//! Application entry point. Everything here is wiring: load config, start
//! telemetry, build the container, serve HTTP, shut down cleanly.

mod config;
mod container;
mod notifiers;
mod server;
mod telemetry;

use anyhow::Context;

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

    let outcome = server::run(container.clone(), &config).await;

    background.cancel();
    container.shutdown().await;
    telemetry.shutdown().await;
    outcome
}
