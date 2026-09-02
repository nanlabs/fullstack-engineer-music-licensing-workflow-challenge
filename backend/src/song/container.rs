use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use crate::iam::user::UserRepository;
use crate::label::LabelRepository;

use super::adapters::PostgresSongRepository;
use super::port::SongRepository;
use super::service::SongService;

#[derive(Clone)]
pub struct SongContainer {
    pub svc: web::Data<SongService>,
    pub repo: Arc<dyn SongRepository>,
}

impl SongContainer {
    pub fn new(
        pool: PgPool,
        user_repo: Arc<dyn UserRepository>,
        label_repo: Arc<dyn LabelRepository>,
    ) -> Self {
        let repo: Arc<dyn SongRepository> = Arc::new(PostgresSongRepository::new(pool));
        let svc = web::Data::new(SongService::new(repo.clone(), user_repo, label_repo));
        Self { svc, repo }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
