//! Music Licensing Workflow API.
//!
//! Executable commands: `migrate`, `seed`, `serve`.

use std::process::ExitCode;

use music_licensing_api::config::Config;
use music_licensing_api::infrastructure::db;
use music_licensing_api::{server, telemetry};

#[tokio::main]
async fn main() -> ExitCode {
    telemetry::init();

    let command = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "serve".to_string());

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            tracing::error!(error = %error, "invalid configuration");
            return ExitCode::FAILURE;
        }
    };

    let outcome = match command.as_str() {
        "migrate" => migrate(&config).await,
        "seed" => seed(&config).await,
        "serve" => server::serve(&config).await,
        other => {
            tracing::error!(command = %other, "unknown command");
            eprintln!("usage: music-licensing-api <migrate|seed|serve>");
            return ExitCode::FAILURE;
        }
    };

    match outcome {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(command = %command, error = ?error, "command failed");
            ExitCode::FAILURE
        }
    }
}

async fn migrate(config: &Config) -> anyhow::Result<()> {
    let pool = db::connect_for_command(config).await?;
    db::run_migrations(&pool).await?;
    pool.close().await;

    tracing::info!("migrations applied");
    Ok(())
}

async fn seed(_config: &Config) -> anyhow::Result<()> {
    // The deterministic development seed arrives with the catalog APIs. Until
    // then this is a successful no-op rather than an error, so that the compose
    // chain (postgres -> migrate -> seed -> api) still starts the API.
    tracing::warn!("no seed data is defined yet; nothing to insert");
    Ok(())
}
