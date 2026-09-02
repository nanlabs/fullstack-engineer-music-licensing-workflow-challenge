use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use crate::iam::user::UserRepository;

use super::adapters::PostgresMovieRepository;
use super::port::MovieRepository;
use super::service::MovieService;

#[derive(Clone)]
pub struct MovieContainer {
    pub svc: web::Data<MovieService>,
    pub repo: Arc<dyn MovieRepository>,
}

impl MovieContainer {
    pub fn new(pool: PgPool, user_repo: Arc<dyn UserRepository>) -> Self {
        let repo: Arc<dyn MovieRepository> = Arc::new(PostgresMovieRepository::new(pool));
        let svc = web::Data::new(MovieService::new(repo.clone(), user_repo));
        Self { svc, repo }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
