//! HTTP server startup and graceful shutdown.

use tokio::net::TcpListener;
use tokio::signal;

use crate::api::{self, AppState};
use crate::config::Config;
use crate::infrastructure::db;

/// Binds the configured address and serves until a shutdown signal arrives.
pub async fn serve(config: &Config) -> anyhow::Result<()> {
    let pool = db::build_pool(&config.database);
    let router = api::router(AppState::new(pool.clone(), config), config);

    let listener = TcpListener::bind(config.bind_address).await?;
    tracing::info!(
        address = %listener.local_addr()?,
        dev_token_endpoint_enabled = config.dev_token_endpoint_enabled,
        "server listening"
    );

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    // Draining the pool after the server stops accepting requests lets
    // in-flight transactions finish before the process exits.
    tracing::info!("shutdown signal received, closing database pool");
    pool.close().await;

    Ok(())
}

/// Resolves on Ctrl-C or, on Unix, SIGTERM — the signal a container runtime
/// sends first.
async fn shutdown_signal() {
    let interrupt = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl-C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = interrupt => {}
        _ = terminate => {}
    }
}
