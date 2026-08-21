//! Structured logging.

use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

/// Installs the process-wide JSON subscriber.
///
/// `RUST_LOG` overrides the default filter; the default keeps the application
/// at `info` and silences dependency chatter.
pub fn init() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("music_licensing_api=info,tower_http=info,sqlx=warn,info")
    });

    tracing_subscriber::registry()
        .with(filter)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(false)
                .with_target(true),
        )
        .init();
}
