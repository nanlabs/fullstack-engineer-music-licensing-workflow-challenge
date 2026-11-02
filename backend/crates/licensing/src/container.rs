//! Licensing composition. Mirrors `iam::Container`: receives shared
//! infrastructure through [`Deps`], builds repositories and services with
//! plain constructors, registers routes under `/api/v1` and starts the
//! background jobs (the expiry sweep and, with Redis, the subscriber that
//! feeds the local event bus).

use std::sync::Arc;

use actix_web::middleware::from_fn;
use actix_web::web;
use chrono::Utc;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::events::api::handlers as events_h;
use crate::events::bus::EventBus;
use crate::events::infra::redis::{subscribe_forever, RedisPublisher};
use crate::events::service::EventStreamService;
use crate::events::EVENT_BUFFER;
use crate::license::api::handlers as license_h;
use crate::license::config::LicensingConfig;
use crate::license::infra::postgres::PostgresLicenseRepository;
use crate::license::port::EventPublisher;
use crate::license::service::LicenseService;
use crate::movie::api::handlers as movie_h;
use crate::movie::infra::postgres::PostgresMovieRepository;
use crate::movie::service::MovieService;
use crate::scene::api::handlers as scene_h;
use crate::scene::infra::postgres::PostgresSceneRepository;
use crate::scene::service::SceneService;
use crate::song::api::handlers as song_h;
use crate::song::infra::postgres::PostgresSongRepository;
use crate::song::service::SongService;
use crate::track::api::handlers as track_h;
use crate::track::infra::postgres::PostgresTrackRepository;
use crate::track::service::TrackService;

/// What the composition root hands over. `redis` is the optional fan-out of
/// license events between instances (`REDIS_URL`); `shutdown` is cancelled
/// when the process stops so open event streams end at once instead of
/// holding the graceful shutdown.
pub struct Deps {
    pub pool: PgPool,
    pub config: LicensingConfig,
    pub redis: Option<redis::Client>,
    pub shutdown: CancellationToken,
}

#[derive(Clone)]
pub struct Container {
    pool: PgPool,
    config: LicensingConfig,
    redis: Option<redis::Client>,
    /// The in-process fan-out every open stream reads from.
    pub bus: EventBus,
    pub movie_service: Arc<MovieService>,
    pub scene_service: Arc<SceneService>,
    pub song_service: Arc<SongService>,
    pub track_service: Arc<TrackService>,
    pub license_service: Arc<LicenseService>,
    pub events_service: Arc<EventStreamService>,
}

impl Container {
    pub fn new(deps: Deps) -> Self {
        let movies = Arc::new(PostgresMovieRepository::new(deps.pool.clone()));
        let scenes = Arc::new(PostgresSceneRepository::new(deps.pool.clone()));
        let tracks = Arc::new(PostgresTrackRepository::new(deps.pool.clone()));
        let licenses = Arc::new(PostgresLicenseRepository::new(deps.pool.clone()));
        let bus = EventBus::new(EVENT_BUFFER);
        // With Redis every instance, this one included, hears transitions
        // through the channel: one path, one order. Without it the bus is
        // the publisher and only this process's clients are reached.
        let publisher: Arc<dyn EventPublisher> = match &deps.redis {
            Some(client) => Arc::new(RedisPublisher::new(client.clone())),
            None => Arc::new(bus.clone()),
        };
        let movie_service = Arc::new(MovieService::new(movies.clone(), tracks.clone()));
        let scene_service = Arc::new(SceneService::new(scenes.clone(), movies.clone(), tracks.clone()));
        let song_service = Arc::new(SongService::new(Arc::new(PostgresSongRepository::new(
            deps.pool.clone(),
        ))));
        let license_service = Arc::new(LicenseService::new(licenses.clone(), tracks.clone(), publisher));
        let events_service = Arc::new(EventStreamService::new(
            licenses,
            bus.clone(),
            deps.config.events.clone(),
            deps.shutdown,
        ));
        let track_service = Arc::new(TrackService::new(tracks, scenes, movies));
        Self {
            pool: deps.pool,
            config: deps.config,
            redis: deps.redis,
            bus,
            movie_service,
            scene_service,
            song_service,
            track_service,
            license_service,
            events_service,
        }
    }

    /// Shared connection pool for the repositories of this context.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Registers licensing routes. Every scope is wrapped with the IAM
    /// authentication middleware, which reads `web::Data<iam::Container>`
    /// registered by `iam::Container::configure` on the same `/api/v1` scope.
    ///
    /// Songs are a tenant-wide catalogue, so `/songs` is a flat scope.
    /// Child collections are registered *inside* the parent scope: actix
    /// hands a request to the first scope whose prefix matches and never
    /// backtracks to a sibling, so a top-level `/movies/{movie_id}/scenes`
    /// scope would be shadowed by `/movies`. Inside one scope the patterns do
    /// not compete: a prefix pattern is anchored to a segment boundary
    /// (`(/|$)`) and a full route to the end (`$`), so `/{movie_id}/scenes`
    /// never captures `/{movie_id}/tracks`, `/{id}` never captures
    /// `/{scene_id}/tracks` nor `/{id}/license` (`actix-router`,
    /// `ResourceDef::parse`). Under `/{id}/license` the literal `/events`
    /// is registered before the dynamic `/{event}`. `/events` is the
    /// tenant's real-time stream.
    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(web::Data::new(self.clone()));

        cfg.service(
            web::scope("/movies")
                .wrap(from_fn(iam::auth::middleware::authenticate))
                .route("", web::get().to(movie_h::list_movies))
                .route("", web::post().to(movie_h::create_movie))
                .route("/{id}", web::get().to(movie_h::get_movie))
                .route("/{id}", web::put().to(movie_h::update_movie))
                .route("/{id}", web::delete().to(movie_h::delete_movie))
                .route("/{movie_id}/tracks", web::get().to(track_h::list_movie_tracks))
                .service(
                    web::scope("/{movie_id}/scenes")
                        .route("", web::get().to(scene_h::list_scenes))
                        .route("", web::post().to(scene_h::create_scene))
                        .route("/order", web::put().to(scene_h::reorder_scenes)),
                ),
        );
        cfg.service(
            web::scope("/scenes")
                .wrap(from_fn(iam::auth::middleware::authenticate))
                .route("/{id}", web::get().to(scene_h::get_scene))
                .route("/{id}", web::put().to(scene_h::update_scene))
                .route("/{id}", web::delete().to(scene_h::delete_scene))
                .service(
                    web::scope("/{scene_id}/tracks")
                        .route("", web::get().to(track_h::list_scene_tracks))
                        .route("", web::post().to(track_h::create_track)),
                ),
        );
        cfg.service(
            web::scope("/songs")
                .wrap(from_fn(iam::auth::middleware::authenticate))
                .route("", web::get().to(song_h::list_songs))
                .route("", web::post().to(song_h::create_song))
                .route("/{id}", web::get().to(song_h::get_song))
                .route("/{id}", web::put().to(song_h::update_song))
                .route("/{id}", web::delete().to(song_h::delete_song)),
        );
        cfg.service(
            web::scope("/tracks")
                .wrap(from_fn(iam::auth::middleware::authenticate))
                .route("/{id}", web::get().to(track_h::get_track))
                .route("/{id}", web::put().to(track_h::update_track))
                .route("/{id}", web::delete().to(track_h::delete_track))
                .service(
                    web::scope("/{id}/license")
                        .route("/events", web::get().to(license_h::list_license_events))
                        .route("/{event}", web::post().to(license_h::transition_license)),
                ),
        );
        cfg.service(
            web::scope("/events")
                .wrap(from_fn(iam::auth::middleware::authenticate))
                .route("", web::get().to(events_h::stream_events)),
        );
    }

    /// Background jobs of this context: the license expiry sweep (same shape
    /// as the IAM cleanup task; the first tick runs immediately) and, with
    /// Redis, the subscriber that relays the channel into the local bus.
    pub fn spawn_background(&self, cancel: CancellationToken) {
        let interval = self.config.expiry_sweep_interval;
        let licenses = self.license_service.clone();

        tokio::spawn({
            let cancel = cancel.clone();
            async move {
                let mut ticker = tokio::time::interval(interval);
                loop {
                    tokio::select! {
                        _ = cancel.cancelled() => break,
                        _ = ticker.tick() => {
                            match licenses.expire_due(Utc::now()).await {
                                Ok(expired) => tracing::info!(expired, "license expiry sweep"),
                                Err(error) => tracing::warn!(error = %error, "license expiry sweep failed"),
                            }
                        }
                    }
                }
                tracing::info!("license expiry sweep stopped");
            }
        });

        if let Some(client) = &self.redis {
            tokio::spawn(subscribe_forever(client.clone(), self.bus.clone(), cancel));
        }
    }
}
