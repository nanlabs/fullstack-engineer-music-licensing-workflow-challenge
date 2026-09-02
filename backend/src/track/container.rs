use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use crate::iam::user::UserRepository;
use crate::movie::MovieRepository;
use crate::scene::SceneRepository;
use crate::song::SongRepository;

use super::adapters::PostgresTrackRepository;
use super::port::TrackRepository;
use super::service::TrackService;

#[derive(Clone)]
pub struct TrackContainer {
    pub svc: web::Data<TrackService>,
    pub repo: Arc<dyn TrackRepository>,
}

impl TrackContainer {
    pub fn new(
        pool: PgPool,
        scene_repo: Arc<dyn SceneRepository>,
        song_repo: Arc<dyn SongRepository>,
        movie_repo: Arc<dyn MovieRepository>,
        user_repo: Arc<dyn UserRepository>,
    ) -> Self {
        let repo: Arc<dyn TrackRepository> = Arc::new(PostgresTrackRepository::new(pool));
        let svc = web::Data::new(TrackService::new(
            repo.clone(),
            scene_repo,
            song_repo,
            movie_repo,
            user_repo,
        ));
        Self { svc, repo }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.svc.clone())
            .configure(super::api::configure);
    }
}
