use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::iam::user::UserRepository;
use crate::label::LabelRepository;
use crate::movie::MovieRepository;
use crate::scene::SceneRepository;
use crate::song::SongRepository;
use crate::track::TrackRepository;

use super::adapters::PostgresLicenseRepository;
use super::model::LicenseEvent;
use super::service::LicenseService;

#[derive(Clone)]
pub struct LicenseContainer {
    pub svc: web::Data<LicenseService>,
}

impl LicenseContainer {
    pub fn new(
        pool: PgPool,
        track_repo: Arc<dyn TrackRepository>,
        scene_repo: Arc<dyn SceneRepository>,
        movie_repo: Arc<dyn MovieRepository>,
        song_repo: Arc<dyn SongRepository>,
        label_repo: Arc<dyn LabelRepository>,
        user_repo: Arc<dyn UserRepository>,
    ) -> Self {
        let license_repo = Arc::new(PostgresLicenseRepository::new(pool));
        let (events_tx, _) = broadcast::channel::<LicenseEvent>(256);
        let svc = web::Data::new(LicenseService::new(
            license_repo,
            track_repo,
            scene_repo,
            movie_repo,
            song_repo,
            label_repo,
            user_repo,
            events_tx,
        ));
        Self { svc }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
