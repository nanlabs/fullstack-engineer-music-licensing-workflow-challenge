//! Music Licensing Workflow API.
//!
//! Executable commands: `migrate`, `seed`, `serve`.

use std::process::ExitCode;

use music_licensing_api::config::{Config, DatabaseConfig};
use music_licensing_api::infrastructure::{db, seed};
use music_licensing_api::{server, telemetry};

#[tokio::main]
async fn main() -> ExitCode {
    telemetry::init();

    let command = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "serve".to_string());

    // The one-shot commands read only database settings, so a migration can run
    // in an environment that holds no application secrets.
    let outcome = match command.as_str() {
        "migrate" => run_with_database_config(migrate).await,
        "seed" => run_with_database_config(seed).await,
        "serve" => match Config::from_env() {
            Ok(config) => server::serve(&config).await,
            Err(error) => Err(error.into()),
        },
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

/// Parses only the database configuration, then runs a one-shot command.
async fn run_with_database_config<F, Fut>(command: F) -> anyhow::Result<()>
where
    F: FnOnce(DatabaseConfig) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<()>>,
{
    let config = DatabaseConfig::from_env()?;
    command(config).await
}

async fn migrate(config: DatabaseConfig) -> anyhow::Result<()> {
    let pool = db::connect_for_command(&config).await?;
    db::run_migrations(&pool).await?;
    pool.close().await;

    tracing::info!("migrations applied");
    Ok(())
}

async fn seed(config: DatabaseConfig) -> anyhow::Result<()> {
    let pool = db::connect_for_command(&config).await?;
    let summary = seed::apply(&pool).await?;
    pool.close().await;

    tracing::info!(
        movies = summary.movies,
        scenes = summary.scenes,
        songs = summary.songs,
        "seed data applied"
    );
    Ok(())
}
