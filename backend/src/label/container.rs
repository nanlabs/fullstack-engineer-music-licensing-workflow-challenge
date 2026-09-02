use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use crate::iam::user::UserRepository;

use super::adapters::PostgresLabelRepository;
use super::port::LabelRepository;
use super::service::LabelService;

#[derive(Clone)]
pub struct LabelContainer {
    pub svc: web::Data<LabelService>,
    pub repo: Arc<dyn LabelRepository>,
}

impl LabelContainer {
    pub fn new(pool: PgPool, user_repo: Arc<dyn UserRepository>) -> Self {
        let repo: Arc<dyn LabelRepository> = Arc::new(PostgresLabelRepository::new(pool));
        let svc = web::Data::new(LabelService::new(repo.clone(), user_repo));
        Self { svc, repo }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
