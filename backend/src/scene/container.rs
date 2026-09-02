use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use crate::movie::MovieRepository;

use super::adapters::PostgresSceneRepository;
use super::port::SceneRepository;
use super::service::SceneService;

#[derive(Clone)]
pub struct SceneContainer {
    pub svc: web::Data<SceneService>,
    pub repo: Arc<dyn SceneRepository>,
}

impl SceneContainer {
    pub fn new(pool: PgPool, movie_repo: Arc<dyn MovieRepository>) -> Self {
        let repo: Arc<dyn SceneRepository> = Arc::new(PostgresSceneRepository::new(pool));
        let svc = web::Data::new(SceneService::new(repo.clone(), movie_repo));
        Self { svc, repo }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
