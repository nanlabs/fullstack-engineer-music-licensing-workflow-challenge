use std::collections::HashSet;
use std::sync::Arc;

use chrono::Utc;
use errx::AppError;
use iam::{authz, scopes};
use kernel::{AuthContext, MovieId, SceneId};
use validator::Validate;

use super::port::SceneRepository;
use super::{
    check_window, CreateSceneRequest, ReorderScenesRequest, Scene, SceneError, SceneList, SceneResponse,
    UpdateSceneRequest,
};
use crate::movie::port::MovieRepository;
use crate::movie::MovieError;
use crate::text::{normalize_optional, normalize_required};
use crate::track::port::TrackRepository;

/// Scene use cases. Scenes are read and written with the movie scopes; the
/// parent movie must exist in the caller's tenant for every collection call.
/// The track port is consulted to keep a scene's window consistent with the
/// tracks already placed in it, and to refuse deleting a scene while one of
/// its tracks has an active license (the scene is what the cue was quoted
/// or approved for).
pub struct SceneService {
    scenes: Arc<dyn SceneRepository>,
    movies: Arc<dyn MovieRepository>,
    tracks: Arc<dyn TrackRepository>,
}

impl SceneService {
    pub fn new(
        scenes: Arc<dyn SceneRepository>,
        movies: Arc<dyn MovieRepository>,
        tracks: Arc<dyn TrackRepository>,
    ) -> Self {
        Self { scenes, movies, tracks }
    }

    pub async fn list(&self, ctx: &AuthContext, movie_id: MovieId) -> Result<SceneList, SceneError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        self.ensure_movie(ctx, movie_id).await?;
        let scenes = self.scenes.list_by_movie(ctx.tenant_id, movie_id).await?;
        Ok(to_list(&scenes))
    }

    pub async fn get(&self, ctx: &AuthContext, id: SceneId) -> Result<SceneResponse, SceneError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let scene = self.load(ctx, id).await?;
        Ok(SceneResponse::from(&scene))
    }

    pub async fn create(
        &self,
        ctx: &AuthContext,
        movie_id: MovieId,
        req: CreateSceneRequest,
    ) -> Result<SceneResponse, SceneError> {
        req.validate().map_err(AppError::from)?;
        check_window(req.start_ms, req.end_ms)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        self.ensure_movie(ctx, movie_id).await?;

        let now = Utc::now();
        let scene = Scene {
            id: SceneId::generate(),
            tenant_id: ctx.tenant_id,
            movie_id,
            position: 0, // assigned by the repository under the movie lock
            title: normalize_required(&req.title, "title")?,
            description: normalize_optional(req.description),
            start_ms: req.start_ms,
            end_ms: req.end_ms,
            created_at: now,
            updated_at: now,
        };
        let stored = self
            .scenes
            .insert(&scene)
            .await?
            .ok_or(SceneError::Movie(MovieError::NotFound))?;
        Ok(SceneResponse::from(&stored))
    }

    pub async fn update(
        &self,
        ctx: &AuthContext,
        id: SceneId,
        req: UpdateSceneRequest,
    ) -> Result<SceneResponse, SceneError> {
        req.validate().map_err(AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let mut scene = self.load(ctx, id).await?;
        let stored_window = (scene.start_ms, scene.end_ms);
        if let Some(title) = req.title {
            scene.title = normalize_required(&title, "title")?;
        }
        if let Some(description) = req.description {
            scene.description = normalize_optional(Some(description));
        }
        if let Some(start_ms) = req.start_ms {
            scene.start_ms = start_ms;
        }
        if let Some(end_ms) = req.end_ms {
            scene.end_ms = end_ms;
        }
        check_window(scene.start_ms, scene.end_ms)?;
        if let Some((start, end)) = new_window(stored_window, (scene.start_ms, scene.end_ms)) {
            let outside = self.tracks.outside_window(ctx.tenant_id, id, start, end).await?;
            if !outside.is_empty() {
                return Err(SceneError::WindowConflict(outside));
            }
        }
        scene.updated_at = Utc::now();
        let scene = self.scenes.update(&scene).await?.ok_or(SceneError::NotFound)?;
        Ok(SceneResponse::from(&scene))
    }

    /// Removes the scene and its tracks, unless one of them has an active
    /// license. The adapter repeats the check inside the `DELETE`, so a
    /// transition racing the request keeps its cue.
    pub async fn delete(&self, ctx: &AuthContext, id: SceneId) -> Result<(), SceneError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        let locked = self.tracks.locked_in_scene(ctx.tenant_id, id).await?;
        if !locked.is_empty() {
            return Err(SceneError::HasActiveLicenses(locked));
        }
        if self.scenes.delete(ctx.tenant_id, id).await? {
            return Ok(());
        }
        // No row: the scene is gone, or a license became active meanwhile.
        let locked = self.tracks.locked_in_scene(ctx.tenant_id, id).await?;
        if locked.is_empty() {
            Err(SceneError::NotFound)
        } else {
            Err(SceneError::HasActiveLicenses(locked))
        }
    }

    /// Rewrites the positions of a movie's scenes to follow `req.scene_ids`.
    pub async fn reorder(
        &self,
        ctx: &AuthContext,
        movie_id: MovieId,
        req: ReorderScenesRequest,
    ) -> Result<SceneList, SceneError> {
        req.validate().map_err(AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        self.ensure_movie(ctx, movie_id).await?;

        let current = self.scenes.list_by_movie(ctx.tenant_id, movie_id).await?;
        check_same_set(&current, &req.scene_ids)?;
        let scenes = self
            .scenes
            .reorder(ctx.tenant_id, movie_id, &req.scene_ids)
            .await?
            .ok_or(SceneError::Movie(MovieError::NotFound))?;
        Ok(to_list(&scenes))
    }

    async fn ensure_movie(&self, ctx: &AuthContext, movie_id: MovieId) -> Result<(), SceneError> {
        match self.movies.get(ctx.tenant_id, movie_id).await? {
            Some(_) => Ok(()),
            None => Err(SceneError::Movie(MovieError::NotFound)),
        }
    }

    async fn load(&self, ctx: &AuthContext, id: SceneId) -> Result<Scene, SceneError> {
        self.scenes.get(ctx.tenant_id, id).await?.ok_or(SceneError::NotFound)
    }
}

fn to_list(scenes: &[Scene]) -> SceneList {
    SceneList {
        items: scenes.iter().map(SceneResponse::from).collect(),
        count: scenes.len(),
    }
}

/// The window to check the tracks against: the resulting one when it is set
/// and differs from what was stored. Clearing the window never conflicts.
fn new_window(stored: (Option<i32>, Option<i32>), current: (Option<i32>, Option<i32>)) -> Option<(i32, i32)> {
    match current {
        (Some(start), Some(end)) if current != stored => Some((start, end)),
        _ => None,
    }
}

/// The requested order must name every scene of the movie exactly once. The
/// error lists what is missing, unknown (another movie or tenant) and repeated.
fn check_same_set(current: &[Scene], requested: &[SceneId]) -> Result<(), AppError> {
    let existing: HashSet<SceneId> = current.iter().map(|s| s.id).collect();
    let mut seen = HashSet::with_capacity(requested.len());
    let mut duplicates = Vec::new();
    let mut unknown = Vec::new();
    for id in requested {
        if !seen.insert(*id) {
            duplicates.push(*id);
            continue;
        }
        if !existing.contains(id) {
            unknown.push(*id);
        }
    }
    let missing: Vec<SceneId> = current.iter().map(|s| s.id).filter(|id| !seen.contains(id)).collect();
    if duplicates.is_empty() && unknown.is_empty() && missing.is_empty() {
        return Ok(());
    }
    Err(
        AppError::validation("scene_ids must contain every scene of the movie exactly once")
            .detail("missing", missing)
            .detail("unknown", unknown)
            .detail("duplicates", duplicates),
    )
}

#[cfg(test)]
mod tests {
    use kernel::{SongId, TenantId, TrackId};
    use serde_json::json;

    use super::*;
    use crate::license::LicenseState;
    use crate::testing::{self, ctx, FakeMovies, FakeScenes, FakeTracks};
    use crate::track::port::TrackRepository;
    use crate::track::{Track, TrackUsage};

    struct Harness {
        service: SceneService,
        tracks: Arc<FakeTracks>,
        tenant: TenantId,
        movie: MovieId,
    }

    fn harness() -> Harness {
        let movies = Arc::new(FakeMovies::default());
        let tenant = TenantId::generate();
        let movie = testing::movie(tenant, "Seeded");
        movies.rows.lock().unwrap().push(movie.clone());
        let scenes = Arc::new(FakeScenes::default());
        let tracks = Arc::new(FakeTracks::new(scenes.clone()));
        Harness {
            service: SceneService::new(scenes, movies, tracks.clone()),
            tracks,
            tenant,
            movie: movie.id,
        }
    }

    fn create_req(title: &str) -> CreateSceneRequest {
        CreateSceneRequest {
            title: title.to_owned(),
            description: None,
            start_ms: None,
            end_ms: None,
        }
    }

    fn code(err: SceneError) -> String {
        AppError::from(err).code().to_owned()
    }

    #[tokio::test]
    async fn create_requires_write_scope() {
        let h = harness();
        let err = h
            .service
            .create(&ctx(h.tenant, &["movies:read"]), h.movie, create_req("Opening"))
            .await
            .unwrap_err();
        let err = AppError::from(err);
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "movies:write");
    }

    #[tokio::test]
    async fn create_appends_position_and_trims() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let first = h
            .service
            .create(
                &writer,
                h.movie,
                CreateSceneRequest {
                    title: "  Opening  ".to_owned(),
                    description: Some("   ".to_owned()),
                    start_ms: Some(0),
                    end_ms: Some(1000),
                },
            )
            .await
            .unwrap();
        let second = h.service.create(&writer, h.movie, create_req("Rooftop")).await.unwrap();
        assert_eq!(first.position, 1);
        assert_eq!(first.title, "Opening");
        assert_eq!(first.description, None);
        assert_eq!((first.start_ms, first.end_ms), (Some(0), Some(1000)));
        assert_eq!(second.position, 2);

        let list = h.service.list(&writer, h.movie).await.unwrap();
        assert_eq!(list.count, 2);
        assert_eq!(list.items[1].id, second.id);
    }

    #[tokio::test]
    async fn unknown_movie_is_not_found() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let err = h
            .service
            .create(&writer, MovieId::generate(), create_req("Lost"))
            .await
            .unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
        let err = h.service.list(&writer, MovieId::generate()).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
    }

    #[tokio::test]
    async fn window_is_validated_before_authorization() {
        let h = harness();
        let nobody = ctx(h.tenant, &[]);
        let backwards = CreateSceneRequest {
            title: "X".to_owned(),
            description: None,
            start_ms: Some(10),
            end_ms: Some(5),
        };
        assert_eq!(
            code(h.service.create(&nobody, h.movie, backwards).await.unwrap_err()),
            "VALIDATION_ERROR"
        );
        let half = CreateSceneRequest {
            title: "X".to_owned(),
            description: None,
            start_ms: Some(10),
            end_ms: None,
        };
        assert_eq!(
            code(h.service.create(&nobody, h.movie, half).await.unwrap_err()),
            "VALIDATION_ERROR"
        );
        // A blank title passes the length validator and is caught after authorization.
        let writer = ctx(h.tenant, &["movies:*"]);
        let err = AppError::from(h.service.create(&writer, h.movie, create_req("   ")).await.unwrap_err());
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "title");
    }

    #[tokio::test]
    async fn update_clears_window_with_null() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let scene = h
            .service
            .create(
                &writer,
                h.movie,
                CreateSceneRequest {
                    title: "Opening".to_owned(),
                    description: Some("Night".to_owned()),
                    start_ms: Some(0),
                    end_ms: Some(1000),
                },
            )
            .await
            .unwrap();

        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "start_ms": 500 })).unwrap();
        let updated = h.service.update(&writer, scene.id, patch).await.unwrap();
        assert_eq!((updated.start_ms, updated.end_ms), (Some(500), Some(1000)));
        assert_eq!(updated.description.as_deref(), Some("Night"));

        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "start_ms": 2000 })).unwrap();
        assert_eq!(
            code(h.service.update(&writer, scene.id, patch).await.unwrap_err()),
            "VALIDATION_ERROR"
        );

        let patch: UpdateSceneRequest =
            serde_json::from_value(json!({ "start_ms": null, "end_ms": null, "description": "" })).unwrap();
        let updated = h.service.update(&writer, scene.id, patch).await.unwrap();
        assert_eq!((updated.start_ms, updated.end_ms), (None, None));
        assert_eq!(updated.description, None);
        assert_eq!(updated.position, 1);
    }

    #[tokio::test]
    async fn window_cannot_exclude_tracks() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let scene = h
            .service
            .create(
                &writer,
                h.movie,
                CreateSceneRequest {
                    title: "Opening".to_owned(),
                    description: None,
                    start_ms: Some(0),
                    end_ms: Some(1000),
                },
            )
            .await
            .unwrap();
        let now = Utc::now();
        let placed = Track {
            id: TrackId::generate(),
            tenant_id: h.tenant,
            scene_id: scene.id,
            song_id: SongId::generate(),
            start_ms: 100,
            end_ms: 400,
            usage: TrackUsage::Background,
            created_at: now,
            updated_at: now,
        };
        h.tracks.rows.lock().unwrap().push(placed.clone());

        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "start_ms": 200 })).unwrap();
        let err = AppError::from(h.service.update(&writer, scene.id, patch).await.unwrap_err());
        assert_eq!(err.code(), "SCENE_WINDOW_CONFLICT");
        assert_eq!(err.details()["track_ids"], json!([placed.id]));

        // Widening, an unrelated edit and clearing the window are all fine.
        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "start_ms": 0, "end_ms": 5000 })).unwrap();
        assert!(h.service.update(&writer, scene.id, patch).await.is_ok());
        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "title": "Opening night" })).unwrap();
        assert!(h.service.update(&writer, scene.id, patch).await.is_ok());
        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "start_ms": null, "end_ms": null })).unwrap();
        let updated = h.service.update(&writer, scene.id, patch).await.unwrap();
        assert_eq!((updated.start_ms, updated.end_ms), (None, None));
    }

    #[tokio::test]
    async fn reorder_rejects_incomplete_sets() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let mut ids = Vec::new();
        for title in ["One", "Two", "Three"] {
            ids.push(h.service.create(&writer, h.movie, create_req(title)).await.unwrap().id);
        }
        let stranger = SceneId::generate();

        let req = ReorderScenesRequest {
            scene_ids: vec![ids[2], ids[0], ids[0], stranger],
        };
        let err = AppError::from(h.service.reorder(&writer, h.movie, req).await.unwrap_err());
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["missing"], json!([ids[1]]));
        assert_eq!(err.details()["unknown"], json!([stranger]));
        assert_eq!(err.details()["duplicates"], json!([ids[0]]));

        let req = ReorderScenesRequest { scene_ids: vec![] };
        assert_eq!(
            code(h.service.reorder(&writer, h.movie, req).await.unwrap_err()),
            "VALIDATION_ERROR"
        );
    }

    #[tokio::test]
    async fn reorder_applies_new_positions() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let mut ids = Vec::new();
        for title in ["One", "Two", "Three"] {
            ids.push(h.service.create(&writer, h.movie, create_req(title)).await.unwrap().id);
        }
        let reversed: Vec<SceneId> = ids.iter().rev().copied().collect();

        let list = h
            .service
            .reorder(
                &writer,
                h.movie,
                ReorderScenesRequest {
                    scene_ids: reversed.clone(),
                },
            )
            .await
            .unwrap();
        assert_eq!(list.items.iter().map(|s| s.id).collect::<Vec<_>>(), reversed);
        assert_eq!(list.items.iter().map(|s| s.position).collect::<Vec<_>>(), vec![1, 2, 3]);
        let again = h.service.list(&writer, h.movie).await.unwrap();
        assert_eq!(again.items.iter().map(|s| s.id).collect::<Vec<_>>(), reversed);

        let reader = ctx(h.tenant, &["movies:read"]);
        let err = h
            .service
            .reorder(&reader, h.movie, ReorderScenesRequest { scene_ids: ids })
            .await
            .unwrap_err();
        assert_eq!(code(err), "ACCESS_DENIED");
    }

    #[tokio::test]
    async fn delete_is_blocked_by_active_licenses() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let scene = h.service.create(&writer, h.movie, create_req("Opening")).await.unwrap();
        let now = Utc::now();
        let placed = Track {
            id: TrackId::generate(),
            tenant_id: h.tenant,
            scene_id: scene.id,
            song_id: h.tracks.add_song(h.tenant, "Velvet Static"),
            start_ms: 100,
            end_ms: 400,
            usage: TrackUsage::Background,
            created_at: now,
            updated_at: now,
        };
        h.tracks.insert(&placed).await.unwrap();
        h.tracks.set_license(placed.id, LicenseState::Approved, None);

        let err = AppError::from(h.service.delete(&writer, scene.id).await.unwrap_err());
        assert_eq!(
            (err.code(), err.kind().http_status()),
            ("SCENE_HAS_ACTIVE_LICENSES", 409)
        );
        assert_eq!(err.details()["track_ids"], json!([placed.id]));
        assert!(h.service.get(&writer, scene.id).await.is_ok());

        // `expired` frees the cue, and with it the scene.
        h.tracks.set_license(placed.id, LicenseState::Expired, None);
        h.service.delete(&writer, scene.id).await.unwrap();
        assert_eq!(
            code(h.service.get(&writer, scene.id).await.unwrap_err()),
            "SCENE_NOT_FOUND"
        );
    }

    #[tokio::test]
    async fn tenants_are_isolated() {
        let h = harness();
        let writer = ctx(h.tenant, &["movies:*"]);
        let scene = h.service.create(&writer, h.movie, create_req("Mine")).await.unwrap();
        let outsider = ctx(TenantId::generate(), &["*"]);

        assert_eq!(
            code(h.service.get(&outsider, scene.id).await.unwrap_err()),
            "SCENE_NOT_FOUND"
        );
        assert_eq!(
            code(h.service.list(&outsider, h.movie).await.unwrap_err()),
            "MOVIE_NOT_FOUND"
        );
        assert_eq!(
            code(h.service.delete(&outsider, scene.id).await.unwrap_err()),
            "SCENE_NOT_FOUND"
        );
        let patch: UpdateSceneRequest = serde_json::from_value(json!({ "title": "Theirs" })).unwrap();
        assert_eq!(
            code(h.service.update(&outsider, scene.id, patch).await.unwrap_err()),
            "SCENE_NOT_FOUND"
        );
        let err = h
            .service
            .reorder(
                &outsider,
                h.movie,
                ReorderScenesRequest {
                    scene_ids: vec![scene.id],
                },
            )
            .await
            .unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
    }
}
