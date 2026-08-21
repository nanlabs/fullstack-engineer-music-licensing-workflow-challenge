//! HTTP server startup and graceful shutdown.

use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::oneshot;

use crate::api::{self, AppState};
use crate::config::Config;
use crate::infrastructure::db;
use crate::infrastructure::event_listener::{self, EventStreams};

/// How long in-flight requests and closing streams have after the shutdown
/// signal before the process stops waiting for them.
const SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(10);

/// How long the listener task has to notice shutdown and release its
/// connection. It only has to observe a flag, so this is generous.
const LISTENER_STOP_TIMEOUT: Duration = Duration::from_secs(2);

/// Binds the configured address and serves until a shutdown signal arrives.
pub async fn serve(config: &Config) -> anyhow::Result<()> {
    let pool = db::build_pool(&config.database);

    // One dedicated listener connection per process, outside the request pool,
    // feeding every open stream. It is started before the router so that a
    // client connecting immediately finds live updates available.
    let events = Arc::new(EventStreams::new(config.sse_max_connections));
    let listener_task = event_listener::spawn(&config.database, Arc::clone(&events));

    let router = api::router(
        AppState::new(pool.clone(), config, Arc::clone(&events)),
        config,
    );

    let listener = TcpListener::bind(config.bind_address).await?;
    tracing::info!(
        address = %listener.local_addr()?,
        dev_token_endpoint_enabled = config.dev_token_endpoint_enabled,
        sse_max_connections = config.sse_max_connections,
        "server listening"
    );

    // The signal is reported back out of the graceful-shutdown future so that
    // the grace period is measured from the signal, not from startup.
    let (signalled_tx, signalled_rx) = oneshot::channel();
    let closing_streams = Arc::clone(&events);

    let server = tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                shutdown_signal().await;
                tracing::info!("shutdown signal received, closing event streams");

                // Open streams are closed explicitly. Without this, graceful
                // shutdown would wait for connections that are designed never
                // to end on their own.
                closing_streams.shutdown();
                let _ = signalled_tx.send(());
            })
            .await
    });

    // Resolves on the signal, or immediately if the server stopped on its own.
    let _ = signalled_rx.await;

    match tokio::time::timeout(SHUTDOWN_GRACE_PERIOD, server).await {
        Ok(joined) => joined??,
        Err(_) => tracing::warn!(
            grace_period_secs = SHUTDOWN_GRACE_PERIOD.as_secs(),
            "grace period elapsed; dropping remaining connections"
        ),
    }

    // The listener observes the same shutdown flag the streams did.
    if tokio::time::timeout(LISTENER_STOP_TIMEOUT, listener_task)
        .await
        .is_err()
    {
        tracing::warn!("event listener did not stop within its timeout");
    }

    // Draining the pool after the server stops accepting requests lets
    // in-flight transactions finish before the process exits.
    tracing::info!("closing database pool");
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
