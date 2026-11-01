//! Logging and tracing setup.
//!
//! Always installs a `tracing` subscriber with an env filter and a stdout
//! formatter. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set it also exports
//! spans and log records over OTLP gRPC. The compose file points that at a
//! Datadog Agent, which maps `service.name`, `service.version` and
//! `deployment.environment.name` to its service, version and env tags and
//! correlates logs with traces through the trace id carried by each record.

use opentelemetry::trace::TracerProvider as _;
use opentelemetry::{global, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, SpanExporter, WithExportConfig};
use opentelemetry_sdk::logs::SdkLoggerProvider;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace::SdkTracerProvider;
use opentelemetry_sdk::Resource;
use opentelemetry_semantic_conventions::attribute::{DEPLOYMENT_ENVIRONMENT_NAME, SERVICE_VERSION};
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::prelude::*;
use tracing_subscriber::EnvFilter;

use crate::config::{LogFormat, ServerConfig, TelemetryConfig};

/// Keeps exporters alive. Call [`TelemetryGuard::shutdown`] before exit to
/// flush pending spans and logs.
pub struct TelemetryGuard {
    tracer_provider: Option<SdkTracerProvider>,
    logger_provider: Option<SdkLoggerProvider>,
}

impl TelemetryGuard {
    /// Flushes and shuts the exporters down. Runs on a blocking thread so the
    /// async runtime stays free to drive the gRPC export while we wait.
    pub async fn shutdown(self) {
        let TelemetryGuard {
            tracer_provider,
            logger_provider,
        } = self;
        if tracer_provider.is_none() && logger_provider.is_none() {
            return;
        }
        let result = tokio::task::spawn_blocking(move || {
            if let Some(provider) = tracer_provider {
                if let Err(err) = provider.shutdown() {
                    eprintln!("tracer provider shutdown failed: {err}");
                }
            }
            if let Some(provider) = logger_provider {
                if let Err(err) = provider.shutdown() {
                    eprintln!("logger provider shutdown failed: {err}");
                }
            }
        })
        .await;
        if let Err(err) = result {
            eprintln!("telemetry shutdown task failed: {err}");
        }
    }
}

pub fn init(telemetry: &TelemetryConfig, server: &ServerConfig) -> anyhow::Result<TelemetryGuard> {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,actix_server=warn"));

    let fmt_layer = match server.log_format {
        LogFormat::Json => tracing_subscriber::fmt::layer().json().flatten_event(true).boxed(),
        LogFormat::Pretty => tracing_subscriber::fmt::layer().compact().boxed(),
    };

    let Some(endpoint) = telemetry
        .otlp_endpoint
        .as_deref()
        .map(str::trim)
        .filter(|e| !e.is_empty())
    else {
        tracing_subscriber::registry().with(filter).with(fmt_layer).try_init()?;
        return Ok(TelemetryGuard {
            tracer_provider: None,
            logger_provider: None,
        });
    };

    let resource = Resource::builder()
        .with_service_name(telemetry.service_name.clone())
        .with_attributes([
            KeyValue::new(SERVICE_VERSION, telemetry.service_version.clone()),
            KeyValue::new(DEPLOYMENT_ENVIRONMENT_NAME, server.env.to_string()),
            // Older agents only understand the pre-1.27 attribute name.
            KeyValue::new("deployment.environment", server.env.to_string()),
        ])
        .build();

    // Traces. The batch processor runs on its own thread; the tonic channel
    // must be created inside the tokio runtime, which `main` guarantees.
    let span_exporter = SpanExporter::builder().with_tonic().with_endpoint(endpoint).build()?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_batch_exporter(span_exporter)
        .with_resource(resource.clone())
        .build();
    global::set_text_map_propagator(TraceContextPropagator::new());
    global::set_tracer_provider(tracer_provider.clone());
    let tracer = tracer_provider.tracer(telemetry.service_name.clone());
    let otel_trace_layer = tracing_opentelemetry::layer()
        .with_tracer(tracer)
        .with_error_fields_to_exceptions(true);

    // Logs. Exporter internals are excluded from the bridge so that a failing
    // export cannot generate log records that trigger more exports.
    let log_exporter = LogExporter::builder().with_tonic().with_endpoint(endpoint).build()?;
    let logger_provider = SdkLoggerProvider::builder()
        .with_batch_exporter(log_exporter)
        .with_resource(resource)
        .build();
    let bridge_filter = Targets::new()
        .with_default(LevelFilter::TRACE)
        .with_target("opentelemetry", LevelFilter::OFF)
        .with_target("opentelemetry_sdk", LevelFilter::OFF)
        .with_target("opentelemetry_otlp", LevelFilter::OFF)
        .with_target("tonic", LevelFilter::OFF)
        .with_target("h2", LevelFilter::OFF)
        .with_target("hyper", LevelFilter::OFF)
        .with_target("hyper_util", LevelFilter::OFF)
        .with_target("tower", LevelFilter::OFF);
    let otel_log_layer = OpenTelemetryTracingBridge::new(&logger_provider).with_filter(bridge_filter);

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .with(otel_trace_layer)
        .with(otel_log_layer)
        .try_init()?;

    tracing::info!(
        endpoint,
        "opentelemetry export enabled (traces and logs over otlp/grpc)"
    );
    Ok(TelemetryGuard {
        tracer_provider: Some(tracer_provider),
        logger_provider: Some(logger_provider),
    })
}
