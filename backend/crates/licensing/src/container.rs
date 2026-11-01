//! Licensing composition. Mirrors `iam::Container`: receives shared
//! infrastructure through [`Deps`], builds repositories and services with
//! plain constructors and registers routes under `/api/v1`.

use actix_web::web;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

pub struct Deps {
    pub pool: PgPool,
}

#[derive(Clone)]
pub struct Container {
    pool: PgPool,
}

impl Container {
    pub fn new(deps: Deps) -> Self {
        Self { pool: deps.pool }
    }

    /// Shared connection pool for the repositories of this context.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Registers licensing routes. Empty until the first module lands.
    ///
    /// Once `movie` exists this becomes:
    ///
    /// ```ignore
    /// cfg.service(
    ///     web::scope("/movies")
    ///         .wrap(actix_web::middleware::from_fn(iam::auth::middleware::authenticate))
    ///         .route("", web::get().to(movie_h::list_movies))
    ///         .route("", web::post().to(movie_h::create_movie)),
    /// );
    /// ```
    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(web::Data::new(self.clone()));
    }

    /// Periodic jobs for this context (none yet).
    pub fn spawn_background(&self, _cancel: CancellationToken) {}
}
