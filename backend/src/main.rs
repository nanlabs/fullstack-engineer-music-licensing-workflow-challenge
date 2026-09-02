use std::time::Duration;

use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, middleware, web};
use sqlx::postgres::PgPoolOptions;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use backend::iam::auth::{AuthConfig, JWTConfig};
use backend::iam::container::IamContainer;
use backend::label::container::LabelContainer;
use backend::license::container::LicenseContainer;
use backend::movie::container::MovieContainer;
use backend::openapi::ApiDoc;
use backend::scene::container::SceneContainer;
use backend::song::container::SongContainer;
use backend::track::container::TrackContainer;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    // ── Database ────────────────────────────────────────────────────────────
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:5432/music_licensing".into());

    let pool = PgPoolOptions::new()
        .max_connections(
            std::env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10),
        )
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // ── Migrations ──────────────────────────────────────────────────────────
    run_migrations(&pool).await;

    // ── Auth config ─────────────────────────────────────────────────────────
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        log::warn!("JWT_SECRET not set — using insecure default (dev only)");
        "dev-secret-key-change-in-production-must-be-32-chars".into()
    });

    let auth_config = AuthConfig {
        jwt: JWTConfig {
            secret_key: jwt_secret,
            access_token_ttl: Duration::from_secs(
                std::env::var("ACCESS_TOKEN_TTL_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(900),
            ),
            refresh_token_ttl: Duration::from_secs(
                std::env::var("REFRESH_TOKEN_TTL_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(604800),
            ),
            issuer: "music-licensing".into(),
        },
        ..Default::default()
    };

    // ── Containers ──────────────────────────────────────────────────────────
    let iam = IamContainer::new(pool.clone(), auth_config);
    let label = LabelContainer::new(pool.clone(), iam.user_repo.clone());
    let movie = MovieContainer::new(pool.clone(), iam.user_repo.clone());
    let scene = SceneContainer::new(pool.clone(), movie.repo.clone());
    let song = SongContainer::new(pool.clone(), iam.user_repo.clone(), label.repo.clone());
    let track = TrackContainer::new(
        pool.clone(),
        scene.repo.clone(),
        song.repo.clone(),
        movie.repo.clone(),
        iam.user_repo.clone(),
    );
    let license = LicenseContainer::new(
        pool,
        track.repo.clone(),
        scene.repo.clone(),
        movie.repo.clone(),
        song.repo.clone(),
        label.repo.clone(),
        iam.user_repo.clone(),
    );

    // ── HTTP server ─────────────────────────────────────────────────────────
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let workers: usize = std::env::var("WORKERS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    log::info!("Starting server on {}", bind);

    let openapi = ApiDoc::openapi();

    let mut server = HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| {
                let allowed = std::env::var("CORS_ORIGIN").unwrap_or_default();
                if allowed.is_empty() || allowed == "*" {
                    return true;
                }
                origin.as_bytes() == allowed.as_bytes()
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Authorization", "Content-Type"])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .route(
                "/health",
                web::get().to(|| async { HttpResponse::Ok().body("ok") }),
            )
            .service(SwaggerUi::new("/docs/{_:.*}").url("/api-docs/openapi.json", openapi.clone()))
            .service(
                web::scope("/api")
                    .configure(|cfg| iam.configure(cfg))
                    .configure(|cfg| label.configure(cfg))
                    .configure(|cfg| movie.configure(cfg))
                    .configure(|cfg| scene.configure(cfg))
                    .configure(|cfg| song.configure(cfg))
                    .configure(|cfg| track.configure(cfg))
                    .configure(|cfg| license.configure(cfg)),
            )
    })
    .shutdown_timeout(30);

    if workers > 0 {
        server = server.workers(workers);
    }

    server.bind(&bind)?.run().await
}

async fn run_migrations(pool: &sqlx::PgPool) {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .expect("Failed to run database migrations");
}
