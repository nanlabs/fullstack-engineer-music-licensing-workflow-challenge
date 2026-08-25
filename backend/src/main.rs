use axum::{
    Router,
    routing::{get, post},
};
use sea_orm::{Database, DatabaseConnection};
use std::env;

mod entities;
mod handlers;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not defined in the .env file");

    print!("Connecting to the database...");

    let db: DatabaseConnection = Database::connect(&db_url).await?;

    println!("Database connection successful!");

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/tracks", post(handlers::create_track))
        .with_state(db);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Server running on http://localhost:3000");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "API is running"
}
