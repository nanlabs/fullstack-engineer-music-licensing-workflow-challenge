//! HTTP server assembly: global middleware, health and info endpoints, and
//! route registration for every bounded context under `/api/v1`.

use std::sync::Arc;
use std::time::Duration;

use actix_cors::Cors;
use actix_web::body::MessageBody;
use actix_web::dev::{ServiceRequest, ServiceResponse};
use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::middleware::{from_fn, Next};
use actix_web::{web, App, HttpMessage, HttpRequest, HttpResponse, HttpServer};
use errx::AppError;
use serde_json::json;
use tracing_actix_web::{RequestId, TracingLogger};

use crate::config::AppConfig;
use crate::container::Container;

pub async fn run(container: Arc<Container>, config: &AppConfig) -> anyhow::Result<()> {
    let server_cfg = config.server.clone();
    let bind = (server_cfg.host.clone(), server_cfg.port);

    let server = HttpServer::new(move || {
        let cors = build_cors(&server_cfg.cors_origins);
        let iam = container.iam.clone();
        let licensing = container.licensing.clone();

        App::new()
            .app_data(web::Data::new(container.clone()))
            // Malformed query strings and path parameters (`?status=bogus`,
            // `/movies/not-a-uuid`) get the same JSON error shape as the rest.
            .app_data(
                web::QueryConfig::default()
                    .error_handler(|err, _| AppError::validation(format!("Invalid query string: {err}")).into()),
            )
            .app_data(
                web::PathConfig::default()
                    .error_handler(|err, _| AppError::validation(format!("Invalid path parameter: {err}")).into()),
            )
            .wrap(from_fn(propagate_request_id))
            .wrap(TracingLogger::default())
            .wrap(cors)
            .route("/health", web::get().to(health))
            .route("/", web::get().to(info))
            .service(
                web::scope("/api/v1")
                    .configure(move |cfg| iam.configure(cfg))
                    .configure(move |cfg| licensing.configure(cfg)),
            )
            .default_service(web::to(not_found))
    })
    .shutdown_timeout(config.server.shutdown_timeout.as_secs())
    .bind(bind.clone())?;

    tracing::info!(host = %bind.0, port = bind.1, "http server listening");
    server.run().await?;
    tracing::info!("http server stopped");
    Ok(())
}

fn build_cors(origins: &[String]) -> Cors {
    let mut cors = Cors::default()
        .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::ACCEPT,
            actix_web::http::header::CONTENT_TYPE,
            // `EventSource` reconnects with `Last-Event-ID`, which browsers
            // do not safelist for CORS yet, and some add `Cache-Control`.
            actix_web::http::header::CACHE_CONTROL,
            HeaderName::from_static("last-event-id"),
            HeaderName::from_static("x-request-id"),
        ])
        .expose_headers(vec![HeaderName::from_static("x-request-id")])
        .supports_credentials()
        .max_age(3600);
    for origin in origins {
        cors = cors.allowed_origin(origin);
    }
    cors
}

/// Echoes the request id assigned by `TracingLogger` so clients and logs can
/// be correlated.
async fn propagate_request_id(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let request_id = req.extensions().get::<RequestId>().map(|id| id.to_string());
    let mut res = next.call(req).await?;
    if let Some(value) = request_id.and_then(|id| HeaderValue::from_str(&id).ok()) {
        res.headers_mut().insert(HeaderName::from_static("x-request-id"), value);
    }
    Ok(res)
}

async fn health(container: web::Data<Arc<Container>>) -> HttpResponse {
    let db_ok = tokio::time::timeout(Duration::from_secs(2), sqlx::query("SELECT 1").execute(&container.pool))
        .await
        .map(|r| r.is_ok())
        .unwrap_or(false);

    let body = json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "service": container.config.telemetry.service_name,
        "version": container.config.telemetry.service_version,
        "environment": container.config.server.env.to_string(),
        "checks": { "database": if db_ok { "healthy" } else { "unhealthy" } },
    });

    if db_ok {
        HttpResponse::Ok().json(body)
    } else {
        HttpResponse::ServiceUnavailable().json(body)
    }
}

async fn info(container: web::Data<Arc<Container>>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "service": container.config.telemetry.service_name,
        "version": container.config.telemetry.service_version,
        "environment": container.config.server.env.to_string(),
        "endpoints": { "health": "/health", "api": "/api/v1" },
    }))
}

async fn not_found(req: HttpRequest) -> HttpResponse {
    HttpResponse::NotFound().json(json!({
        "error": {
            "code": "ROUTE_NOT_FOUND",
            "kind": "NOT_FOUND",
            "message": "The requested endpoint does not exist",
            "details": { "method": req.method().as_str(), "path": req.path() },
        }
    }))
}
