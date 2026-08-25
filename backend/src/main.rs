use axum::{Router, routing::get};
use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL no esta definida en el .env");

    print!("Conectando con la base de datos...");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url) //Borrowing de db_url
        .await?;

    println!("Conexión a la base de datos exitosa!");

    let app = Router::new()
        .route("/health", get(health_check))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Servidor corriendo en http://localhost:3000");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "Api funcionando"
}
