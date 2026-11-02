use std::sync::Arc;

use chrono::Utc;
use errx::AppError;
use iam::{authz, scopes};
use kernel::{AuthContext, MovieId, SceneId, TrackId};
use validator::Validate;

use super::port::TrackRepository;
use super::{
    check_inside_window, check_span, CreateTrackRequest, Track, TrackError, TrackFilter, TrackList, TrackResponse,
    TrackView, UpdateTrackRequest,
};
use crate::movie::port::MovieRepository;
use crate::movie::MovieError;
use crate::scene::port::SceneRepository;
use crate::scene::{Scene, SceneError};

/// Track use cases. Tracks are read and written with the movie scopes (the
/// embedded license status is part of the track; moving it is the license
/// service's job). The scene must exist in the caller's tenant (and its
/// window, when set, must contain the track) for every write; the song is
/// checked by the composite foreign key and surfaced by the adapter as
/// `UnknownSong`. The adapter also creates the `pending` license with the
/// track, in one transaction. While that license is active the cue is
/// frozen: `update` refuses to change the song, timing or usage and
/// `delete` refuses altogether, with a 409 that names the state; the
/// adapter repeats the check inside the write so a transition racing the
/// request cannot slip through.
pub struct TrackService {
    tracks: Arc<dyn TrackRepository>,
    scenes: Arc<dyn SceneRepository>,
    movies: Arc<dyn MovieRepository>,
}

impl TrackService {
    pub fn new(
        tracks: Arc<dyn TrackRepository>,
        scenes: Arc<dyn SceneRepository>,
        movies: Arc<dyn MovieRepository>,
    ) -> Self {
        Self { tracks, scenes, movies }
    }

    pub async fn list_by_scene(
        &self,
        ctx: &AuthContext,
        scene_id: SceneId,
        filter: &TrackFilter,
    ) -> Result<TrackList, TrackError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        self.load_scene(ctx, scene_id).await?;
        let views = self.tracks.list_by_scene(ctx.tenant_id, scene_id, filter.state).await?;
        Ok(to_list(&views))
    }

    pub async fn list_by_movie(
        &self,
        ctx: &AuthContext,
        movie_id: MovieId,
        filter: &TrackFilter,
    ) -> Result<TrackList, TrackError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        if self.movies.get(ctx.tenant_id, movie_id).await?.is_none() {
            return Err(TrackError::Movie(MovieError::NotFound));
        }
        let views = self.tracks.list_by_movie(ctx.tenant_id, movie_id, filter.state).await?;
        Ok(to_list(&views))
    }

    pub async fn get(&self, ctx: &AuthContext, id: TrackId) -> Result<TrackResponse, TrackError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let view = self.load(ctx, id).await?;
        Ok(TrackResponse::from(&view))
    }

    pub async fn create(
        &self,
        ctx: &AuthContext,
        scene_id: SceneId,
        req: CreateTrackRequest,
    ) -> Result<TrackResponse, TrackError> {
        req.validate().map_err(AppError::from)?;
        check_span(req.start_ms, req.end_ms)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        let scene = self.load_scene(ctx, scene_id).await?;
        check_inside_window((scene.start_ms, scene.end_ms), req.start_ms, req.end_ms)?;

        let now = Utc::now();
        let track = Track {
            id: TrackId::generate(),
            tenant_id: ctx.tenant_id,
            scene_id,
            song_id: req.song_id,
            start_ms: req.start_ms,
            end_ms: req.end_ms,
            usage: req.usage,
            created_at: now,
            updated_at: now,
        };
        let view = self.tracks.insert(&track).await?;
        Ok(TrackResponse::from(&view))
    }

    pub async fn update(
        &self,
        ctx: &AuthContext,
        id: TrackId,
        req: UpdateTrackRequest,
    ) -> Result<TrackResponse, TrackError> {
        req.validate().map_err(AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let view = self.load(ctx, id).await?;
        let mut track = view.track.clone();
        // What the request really changes; repeating the stored values is
        // not a change, so it never conflicts with the license.
        let mut fields = Vec::new();
        if let Some(song_id) = req.song_id.filter(|v| *v != track.song_id) {
            track.song_id = song_id;
            fields.push("song_id");
        }
        if let Some(start_ms) = req.start_ms.filter(|v| *v != track.start_ms) {
            track.start_ms = start_ms;
            fields.push("start_ms");
        }
        if let Some(end_ms) = req.end_ms.filter(|v| *v != track.end_ms) {
            track.end_ms = end_ms;
            fields.push("end_ms");
        }
        if let Some(usage) = req.usage.filter(|v| *v != track.usage) {
            track.usage = usage;
            fields.push("usage");
        }
        if fields.is_empty() {
            return Ok(TrackResponse::from(&view));
        }
        if view.license.state.is_active() {
            return Err(TrackError::LockedByLicense {
                state: view.license.state,
                fields,
            });
        }
        check_span(track.start_ms, track.end_ms)?;
        let scene = self.load_scene(ctx, track.scene_id).await?;
        check_inside_window((scene.start_ms, scene.end_ms), track.start_ms, track.end_ms)?;
        track.updated_at = Utc::now();
        match self.tracks.update(&track).await? {
            Some(view) => Ok(TrackResponse::from(&view)),
            None => Err(self.locked_or_missing(ctx, id, fields).await),
        }
    }

    pub async fn delete(&self, ctx: &AuthContext, id: TrackId) -> Result<(), TrackError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        let view = self.load(ctx, id).await?;
        if view.license.state.is_active() {
            return Err(TrackError::LockedByLicense {
                state: view.license.state,
                fields: Vec::new(),
            });
        }
        if self.tracks.delete(ctx.tenant_id, id).await? {
            Ok(())
        } else {
            Err(self.locked_or_missing(ctx, id, Vec::new()).await)
        }
    }

    /// Why a guarded write touched no row: the track is gone, or a
    /// transition activated its license between the check and the write.
    async fn locked_or_missing(&self, ctx: &AuthContext, id: TrackId, fields: Vec<&'static str>) -> TrackError {
        match self.tracks.get(ctx.tenant_id, id).await {
            Ok(Some(view)) => TrackError::LockedByLicense {
                state: view.license.state,
                fields,
            },
            Ok(None) => TrackError::NotFound,
            Err(err) => TrackError::App(err),
        }
    }

    async fn load_scene(&self, ctx: &AuthContext, scene_id: SceneId) -> Result<Scene, TrackError> {
        self.scenes
            .get(ctx.tenant_id, scene_id)
            .await?
            .ok_or(TrackError::Scene(SceneError::NotFound))
    }

    async fn load(&self, ctx: &AuthContext, id: TrackId) -> Result<TrackView, TrackError> {
        self.tracks.get(ctx.tenant_id, id).await?.ok_or(TrackError::NotFound)
    }
}

fn to_list(views: &[TrackView]) -> TrackList {
    TrackList {
        items: views.iter().map(TrackResponse::from).collect(),
        count: views.len(),
    }
}

#[cfg(test)]
mod tests {
    use kernel::{SongId, TenantId};
    use serde_json::json;

    use super::*;
    use crate::license::{LicenseEventKind, LicenseState};
    use crate::testing::{self, ctx, FakeMovies, FakeScenes, FakeTracks};
    use crate::track::TrackUsage;

    fn all() -> TrackFilter {
        TrackFilter::default()
    }

    struct Harness {
        service: TrackService,
        tracks: Arc<FakeTracks>,
        tenant: TenantId,
        movie: MovieId,
        /// Scene with the window `0..=180_000`, position 1.
        windowed: SceneId,
        /// Scene without a window, position 2.
        open: SceneId,
        song_a: SongId,
        song_b: SongId,
    }

    async fn harness() -> Harness {
        let tenant = TenantId::generate();
        let movies = Arc::new(FakeMovies::default());
        let movie = testing::movie(tenant, "Seeded");
        movies.rows.lock().unwrap().push(movie.clone());
        let scenes = Arc::new(FakeScenes::default());
        let windowed = scenes
            .insert(&testing::scene(tenant, movie.id, "Opening", Some((0, 180_000))))
            .await
            .unwrap()
            .unwrap();
        let open = scenes
            .insert(&testing::scene(tenant, movie.id, "Final bow", None))
            .await
            .unwrap()
            .unwrap();
        let tracks = Arc::new(FakeTracks::new(scenes.clone()));
        let song_a = tracks.add_song(tenant, "Velvet Static");
        let song_b = tracks.add_song(tenant, "Paper Moons");
        Harness {
            service: TrackService::new(tracks.clone(), scenes, movies),
            tracks,
            tenant,
            movie: movie.id,
            windowed: windowed.id,
            open: open.id,
            song_a,
            song_b,
        }
    }

    fn req(song_id: SongId, start_ms: i32, end_ms: i32) -> CreateTrackRequest {
        CreateTrackRequest {
            song_id,
            start_ms,
            end_ms,
            usage: TrackUsage::Background,
        }
    }

    fn code(err: TrackError) -> String {
        AppError::from(err).code().to_owned()
    }

    #[tokio::test]
    async fn create_requires_write_scope() {
        let h = harness().await;
        let err = h
            .service
            .create(&ctx(h.tenant, &["movies:read"]), h.windowed, req(h.song_a, 0, 1000))
            .await
            .unwrap_err();
        let err = AppError::from(err);
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "movies:write");
    }

    #[tokio::test]
    async fn create_checks_span_and_window() {
        let h = harness().await;
        // Span rules run before authorization, like every other validation.
        let nobody = ctx(h.tenant, &[]);
        let err = AppError::from(
            h.service
                .create(&nobody, h.windowed, req(h.song_a, 10, 5))
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "end_ms");

        // The window check needs the scene, so it runs after authorization.
        let writer = ctx(h.tenant, &["movies:*"]);
        let err = AppError::from(
            h.service
                .create(&writer, h.windowed, req(h.song_a, 100, 200_000))
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "end_ms");
        assert_eq!(err.details()["scene_end_ms"], 180_000);

        let created = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 15_000, 95_000))
            .await
            .unwrap();
        assert_eq!(created.movie_id, h.movie);
        assert_eq!(created.scene_id, h.windowed);
        assert_eq!(created.song.id, h.song_a);
        assert_eq!(created.song.title, "Velvet Static");
        assert_eq!(created.duration_ms, 80_000);
        assert_eq!(created.usage, TrackUsage::Background);
        // Overlapping the first one is fine.
        assert!(h
            .service
            .create(&writer, h.windowed, req(h.song_b, 90_000, 120_000))
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn scene_without_window_accepts_any_span() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let created = h
            .service
            .create(&writer, h.open, req(h.song_a, 5_400_000, 5_580_000))
            .await
            .unwrap();
        assert_eq!(created.duration_ms, 180_000);
    }

    #[tokio::test]
    async fn unknown_scene_and_song() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let err = h
            .service
            .create(&writer, SceneId::generate(), req(h.song_a, 0, 1000))
            .await
            .unwrap_err();
        assert_eq!(code(err), "SCENE_NOT_FOUND");

        let err = AppError::from(
            h.service
                .create(&writer, h.windowed, req(SongId::generate(), 0, 1000))
                .await
                .unwrap_err(),
        );
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "song_id");

        // A song of another tenant is just as unknown.
        let theirs = h.tracks.add_song(TenantId::generate(), "Not Yours");
        let err = AppError::from(
            h.service
                .create(&writer, h.windowed, req(theirs, 0, 1000))
                .await
                .unwrap_err(),
        );
        assert_eq!(err.details()["field"], "song_id");
    }

    #[tokio::test]
    async fn update_rechecks_window_and_swaps_song() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let track = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 15_000, 95_000))
            .await
            .unwrap();

        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "end_ms": 200_000 })).unwrap();
        let err = AppError::from(h.service.update(&writer, track.id, patch).await.unwrap_err());
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "end_ms");

        let patch: UpdateTrackRequest =
            serde_json::from_value(json!({ "song_id": h.song_b, "usage": "featured", "end_ms": 100_000 })).unwrap();
        let updated = h.service.update(&writer, track.id, patch).await.unwrap();
        assert_eq!(updated.song.id, h.song_b);
        assert_eq!(updated.song.title, "Paper Moons");
        assert_eq!(updated.usage, TrackUsage::Featured);
        assert_eq!(
            (updated.start_ms, updated.end_ms, updated.duration_ms),
            (15_000, 100_000, 85_000)
        );

        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "song_id": SongId::generate() })).unwrap();
        let err = AppError::from(h.service.update(&writer, track.id, patch).await.unwrap_err());
        assert_eq!(err.details()["field"], "song_id");

        let patch = serde_json::from_value::<UpdateTrackRequest>(json!({ "usage": "theme" }));
        assert!(patch.is_err());
    }

    #[tokio::test]
    async fn active_license_freezes_the_cue() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let track = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 15_000, 95_000))
            .await
            .unwrap();
        h.tracks.set_license(track.id, LicenseState::Requested, None);

        // Only what really changes is a change: `end_ms` repeats the stored value.
        let patch: UpdateTrackRequest =
            serde_json::from_value(json!({ "song_id": h.song_b, "end_ms": 95_000 })).unwrap();
        let err = AppError::from(h.service.update(&writer, track.id, patch).await.unwrap_err());
        assert_eq!((err.code(), err.kind().http_status()), ("TRACK_LOCKED_BY_LICENSE", 409));
        assert_eq!(err.details()["state"], "requested");
        assert_eq!(err.details()["fields"], json!(["song_id"]));

        // Repeating every stored value is a no-op, not a conflict.
        let same: UpdateTrackRequest =
            serde_json::from_value(json!({ "song_id": h.song_a, "start_ms": 15_000, "usage": "background" })).unwrap();
        let unchanged = h.service.update(&writer, track.id, same).await.unwrap();
        assert_eq!(unchanged.updated_at, track.updated_at);

        let err = AppError::from(h.service.delete(&writer, track.id).await.unwrap_err());
        assert_eq!(err.code(), "TRACK_LOCKED_BY_LICENSE");
        assert!(err.details().get("fields").is_none());

        // `approved` freezes too; `rejected` (and `expired`) free the cue.
        h.tracks.set_license(track.id, LicenseState::Approved, None);
        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "usage": "featured" })).unwrap();
        let err = AppError::from(h.service.update(&writer, track.id, patch).await.unwrap_err());
        assert_eq!(err.details()["state"], "approved");
        assert_eq!(err.details()["fields"], json!(["usage"]));

        h.tracks.set_license(track.id, LicenseState::Rejected, None);
        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "usage": "featured" })).unwrap();
        let updated = h.service.update(&writer, track.id, patch).await.unwrap();
        assert_eq!(updated.usage, TrackUsage::Featured);
        h.service.delete(&writer, track.id).await.unwrap();
        assert_eq!(
            code(h.service.get(&writer, track.id).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
    }

    #[tokio::test]
    async fn a_transition_racing_the_write_is_reported_as_locked() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let track = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 15_000, 95_000))
            .await
            .unwrap();

        // The service sees `pending`; a `request` commits before the write.
        *h.tracks.race_license.lock().unwrap() = Some(LicenseState::Requested);
        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "usage": "featured" })).unwrap();
        let err = AppError::from(h.service.update(&writer, track.id, patch).await.unwrap_err());
        assert_eq!(err.code(), "TRACK_LOCKED_BY_LICENSE");
        assert_eq!(err.details()["state"], "requested");
        assert_eq!(err.details()["fields"], json!(["usage"]));
        assert_eq!(
            h.service.get(&writer, track.id).await.unwrap().usage,
            TrackUsage::Background
        );

        h.tracks.set_license(track.id, LicenseState::Pending, None);
        *h.tracks.race_license.lock().unwrap() = Some(LicenseState::Negotiating);
        let err = AppError::from(h.service.delete(&writer, track.id).await.unwrap_err());
        assert_eq!(err.code(), "TRACK_LOCKED_BY_LICENSE");
        assert_eq!(err.details()["state"], "negotiating");
        assert!(h.service.get(&writer, track.id).await.is_ok());
    }

    #[tokio::test]
    async fn lists_by_scene_and_movie_in_order() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let late = h.service.create(&writer, h.open, req(h.song_a, 10, 20)).await.unwrap();
        let second = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 50, 60))
            .await
            .unwrap();
        let first = h
            .service
            .create(&writer, h.windowed, req(h.song_b, 20, 30))
            .await
            .unwrap();

        let reader = ctx(h.tenant, &["movies:read"]);
        let scene = h.service.list_by_scene(&reader, h.windowed, &all()).await.unwrap();
        assert_eq!(scene.count, 2);
        assert_eq!(
            scene.items.iter().map(|t| t.id).collect::<Vec<_>>(),
            [first.id, second.id]
        );

        // Scene position first (the windowed scene is position 1), then start.
        let movie = h.service.list_by_movie(&reader, h.movie, &all()).await.unwrap();
        assert_eq!(movie.count, 3);
        assert_eq!(
            movie.items.iter().map(|t| t.id).collect::<Vec<_>>(),
            [first.id, second.id, late.id]
        );
        assert!(movie.items.iter().all(|t| t.movie_id == h.movie));

        assert_eq!(
            code(
                h.service
                    .list_by_movie(&reader, MovieId::generate(), &all())
                    .await
                    .unwrap_err()
            ),
            "MOVIE_NOT_FOUND"
        );
        assert_eq!(
            code(
                h.service
                    .list_by_scene(&reader, SceneId::generate(), &all())
                    .await
                    .unwrap_err()
            ),
            "SCENE_NOT_FOUND"
        );
    }

    #[tokio::test]
    async fn create_starts_pending() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let created = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 15_000, 95_000))
            .await
            .unwrap();
        assert_eq!(created.license.state, LicenseState::Pending);
        assert_eq!(created.license.allowed_events, &[LicenseEventKind::Request]);
        assert_eq!(created.license.expires_at, None);
        let fetched = h.service.get(&writer, created.id).await.unwrap();
        assert_eq!(fetched.license.state, LicenseState::Pending);
    }

    #[tokio::test]
    async fn lists_filter_by_state() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let approved = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 0, 10))
            .await
            .unwrap();
        let pending = h.service.create(&writer, h.open, req(h.song_b, 0, 10)).await.unwrap();
        h.tracks.set_license(approved.id, LicenseState::Approved, None);

        let filter = TrackFilter {
            state: Some(LicenseState::Approved),
        };
        let scene = h.service.list_by_scene(&writer, h.windowed, &filter).await.unwrap();
        assert_eq!(scene.items.iter().map(|t| t.id).collect::<Vec<_>>(), [approved.id]);
        let movie = h.service.list_by_movie(&writer, h.movie, &filter).await.unwrap();
        assert_eq!(movie.items.iter().map(|t| t.id).collect::<Vec<_>>(), [approved.id]);
        assert_eq!(movie.items[0].license.state, LicenseState::Approved);

        let filter = TrackFilter {
            state: Some(LicenseState::Pending),
        };
        let movie = h.service.list_by_movie(&writer, h.movie, &filter).await.unwrap();
        assert_eq!(movie.items.iter().map(|t| t.id).collect::<Vec<_>>(), [pending.id]);
        assert_eq!(
            h.service.list_by_movie(&writer, h.movie, &all()).await.unwrap().count,
            2
        );
    }

    #[tokio::test]
    async fn tenants_are_isolated() {
        let h = harness().await;
        let writer = ctx(h.tenant, &["movies:*"]);
        let track = h
            .service
            .create(&writer, h.windowed, req(h.song_a, 0, 1000))
            .await
            .unwrap();
        let outsider = ctx(TenantId::generate(), &["*"]);

        assert_eq!(
            code(h.service.get(&outsider, track.id).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
        let patch: UpdateTrackRequest = serde_json::from_value(json!({ "usage": "featured" })).unwrap();
        assert_eq!(
            code(h.service.update(&outsider, track.id, patch).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
        assert_eq!(
            code(h.service.delete(&outsider, track.id).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
        assert_eq!(
            code(
                h.service
                    .list_by_scene(&outsider, h.windowed, &all())
                    .await
                    .unwrap_err()
            ),
            "SCENE_NOT_FOUND"
        );
        assert_eq!(
            code(h.service.list_by_movie(&outsider, h.movie, &all()).await.unwrap_err()),
            "MOVIE_NOT_FOUND"
        );
        assert_eq!(
            code(
                h.service
                    .create(&outsider, h.windowed, req(h.song_a, 0, 1000))
                    .await
                    .unwrap_err()
            ),
            "SCENE_NOT_FOUND"
        );

        // Deleting really removes it for the owner.
        h.service.delete(&writer, track.id).await.unwrap();
        assert_eq!(
            code(h.service.get(&writer, track.id).await.unwrap_err()),
            "TRACK_NOT_FOUND"
        );
    }
}
