use axum::{
    Router,
    routing::{get, patch, post},
};
use sea_orm::{Database, DatabaseConnection};
use std::env;
use tracing_subscriber::EnvFilter;

mod entities;
mod error;
mod handlers;
mod validation;
mod workflow;

use tokio::sync::broadcast;
#[derive(Clone)]
struct AppState {
    pub db: DatabaseConnection,
    pub tx: broadcast::Sender<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not defined in the .env file");

    tracing::info!("Connecting to the database...");

    let db: DatabaseConnection = Database::connect(&db_url).await?;

    tracing::info!("Database connection successful!");

    let (tx, _rx) = broadcast::channel(100);
    let state = AppState { db, tx };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/tracks", post(handlers::create_track))
        .route("/movies/{id}/tracks", get(handlers::get_movie_tracks))
        .route("/scenes/{id}/tracks", get(handlers::get_scene_tracks))
        .route("/tracks/{id}/status", patch(handlers::update_track_status))
        .route("/events", get(handlers::sse_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server running on http://localhost:3000");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "API is running"
}
