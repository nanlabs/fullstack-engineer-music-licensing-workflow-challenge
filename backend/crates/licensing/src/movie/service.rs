use std::sync::Arc;

use chrono::Utc;
use errx::AppError;
use iam::{authz, scopes};
use kernel::{AuthContext, MovieId, PageQuery, Paginated};
use validator::Validate;

use super::port::MovieRepository;
use super::{CreateMovieRequest, Movie, MovieError, MovieFilter, MovieResponse, MovieStatus, UpdateMovieRequest};
use crate::text::{normalize_optional, normalize_required};
use crate::track::port::TrackRepository;

/// Movie use cases. Authorization happens here, before any repository call,
/// so jobs, tests and HTTP requests get the same policy. The track port is
/// consulted only to refuse deleting a movie while a track in one of its
/// scenes has an active license.
pub struct MovieService {
    repo: Arc<dyn MovieRepository>,
    tracks: Arc<dyn TrackRepository>,
}

impl MovieService {
    pub fn new(repo: Arc<dyn MovieRepository>, tracks: Arc<dyn TrackRepository>) -> Self {
        Self { repo, tracks }
    }

    pub async fn list(
        &self,
        ctx: &AuthContext,
        filter: MovieFilter,
        page: PageQuery,
    ) -> Result<Paginated<MovieResponse>, MovieError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let page = page.normalized();
        let (movies, total) = self.repo.list(ctx.tenant_id, &filter, page).await?;
        let items = movies.iter().map(MovieResponse::from).collect();
        Ok(Paginated::new(items, page, total))
    }

    pub async fn get(&self, ctx: &AuthContext, id: MovieId) -> Result<MovieResponse, MovieError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let movie = self.load(ctx, id).await?;
        Ok(MovieResponse::from(&movie))
    }

    pub async fn create(&self, ctx: &AuthContext, req: CreateMovieRequest) -> Result<MovieResponse, MovieError> {
        req.validate().map_err(AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let now = Utc::now();
        let movie = Movie {
            id: MovieId::generate(),
            tenant_id: ctx.tenant_id,
            title: normalize_required(&req.title, "title")?,
            synopsis: normalize_optional(req.synopsis),
            release_year: req.release_year,
            status: req.status.unwrap_or(MovieStatus::Draft),
            created_at: now,
            updated_at: now,
        };
        self.repo.insert(&movie).await?;
        Ok(MovieResponse::from(&movie))
    }

    pub async fn update(
        &self,
        ctx: &AuthContext,
        id: MovieId,
        req: UpdateMovieRequest,
    ) -> Result<MovieResponse, MovieError> {
        req.validate().map_err(AppError::from)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let mut movie = self.load(ctx, id).await?;
        if let Some(title) = req.title {
            movie.title = normalize_required(&title, "title")?;
        }
        if let Some(synopsis) = req.synopsis {
            movie.synopsis = normalize_optional(Some(synopsis));
        }
        if let Some(year) = req.release_year {
            movie.release_year = Some(year);
        }
        if let Some(status) = req.status {
            movie.status = status;
        }
        movie.updated_at = Utc::now();
        let movie = self.repo.update(&movie).await?.ok_or(MovieError::NotFound)?;
        Ok(MovieResponse::from(&movie))
    }

    /// Removes the movie with its scenes and tracks, unless a track has an
    /// active license. The adapter repeats the check inside the `DELETE`,
    /// so a transition racing the request keeps its cue.
    pub async fn delete(&self, ctx: &AuthContext, id: MovieId) -> Result<(), MovieError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        let locked = self.tracks.locked_in_movie(ctx.tenant_id, id).await?;
        if !locked.is_empty() {
            return Err(MovieError::HasActiveLicenses(locked));
        }
        if self.repo.delete(ctx.tenant_id, id).await? {
            return Ok(());
        }
        // No row: the movie is gone, or a license became active meanwhile.
        let locked = self.tracks.locked_in_movie(ctx.tenant_id, id).await?;
        if locked.is_empty() {
            Err(MovieError::NotFound)
        } else {
            Err(MovieError::HasActiveLicenses(locked))
        }
    }

    async fn load(&self, ctx: &AuthContext, id: MovieId) -> Result<Movie, MovieError> {
        self.repo.get(ctx.tenant_id, id).await?.ok_or(MovieError::NotFound)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use async_trait::async_trait;
    use chrono::Utc;
    use errx::AppResult;
    use kernel::{Actor, TenantId, TrackId, UserId};
    use serde_json::json;

    use super::*;
    use crate::license::LicenseState;
    use crate::scene::port::SceneRepository;
    use crate::testing::{self, FakeScenes, FakeTracks};
    use crate::track::port::TrackRepository;
    use crate::track::{Track, TrackUsage};

    #[derive(Default)]
    struct FakeRepo {
        rows: Mutex<Vec<Movie>>,
    }

    #[async_trait]
    impl MovieRepository for FakeRepo {
        async fn get(&self, tenant_id: TenantId, id: MovieId) -> AppResult<Option<Movie>> {
            Ok(self
                .rows
                .lock()
                .unwrap()
                .iter()
                .find(|m| m.tenant_id == tenant_id && m.id == id)
                .cloned())
        }

        async fn list(
            &self,
            tenant_id: TenantId,
            filter: &MovieFilter,
            page: PageQuery,
        ) -> AppResult<(Vec<Movie>, u64)> {
            let term = filter.term().map(str::to_lowercase);
            let mut matching: Vec<Movie> = self
                .rows
                .lock()
                .unwrap()
                .iter()
                .filter(|m| m.tenant_id == tenant_id)
                .filter(|m| filter.status.is_none_or(|s| s == m.status))
                .filter(|m| term.as_ref().is_none_or(|q| m.title.to_lowercase().contains(q)))
                .cloned()
                .collect();
            matching.sort_by_key(|m| m.title.to_lowercase());
            let total = matching.len() as u64;
            let items = matching
                .into_iter()
                .skip(page.offset() as usize)
                .take(page.limit() as usize)
                .collect();
            Ok((items, total))
        }

        async fn insert(&self, movie: &Movie) -> AppResult<()> {
            self.rows.lock().unwrap().push(movie.clone());
            Ok(())
        }

        async fn update(&self, movie: &Movie) -> AppResult<Option<Movie>> {
            let mut rows = self.rows.lock().unwrap();
            match rows
                .iter_mut()
                .find(|m| m.tenant_id == movie.tenant_id && m.id == movie.id)
            {
                Some(row) => {
                    *row = movie.clone();
                    Ok(Some(movie.clone()))
                }
                None => Ok(None),
            }
        }

        async fn delete(&self, tenant_id: TenantId, id: MovieId) -> AppResult<bool> {
            let mut rows = self.rows.lock().unwrap();
            let before = rows.len();
            rows.retain(|m| !(m.tenant_id == tenant_id && m.id == id));
            Ok(rows.len() < before)
        }
    }

    fn ctx_in(tenant: TenantId, scopes: &[&str]) -> AuthContext {
        AuthContext {
            actor: Actor::user(UserId::generate()),
            tenant_id: tenant,
            session_id: None,
            email: None,
            name: None,
            scopes: scopes.iter().map(|s| s.to_string()).collect(),
        }
    }

    fn ctx(scopes: &[&str]) -> AuthContext {
        ctx_in(TenantId::generate(), scopes)
    }

    fn service() -> MovieService {
        MovieService::new(
            Arc::new(FakeRepo::default()),
            Arc::new(FakeTracks::new(Arc::new(FakeScenes::default()))),
        )
    }

    fn create_req(title: &str) -> CreateMovieRequest {
        CreateMovieRequest {
            title: title.to_owned(),
            synopsis: None,
            release_year: None,
            status: None,
        }
    }

    fn code(err: MovieError) -> String {
        AppError::from(err).code().to_owned()
    }

    #[tokio::test]
    async fn create_requires_write_scope() {
        let svc = service();
        let err = svc
            .create(&ctx(&["movies:read"]), create_req("Static"))
            .await
            .unwrap_err();
        let err = AppError::from(err);
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "movies:write");

        assert!(svc.create(&ctx(&["movies:*"]), create_req("Static")).await.is_ok());
        assert!(svc.create(&ctx(&["*"]), create_req("Static")).await.is_ok());
    }

    #[tokio::test]
    async fn create_trims_and_defaults_status() {
        let svc = service();
        let req = CreateMovieRequest {
            title: "  The Last Encore  ".into(),
            synopsis: Some("   ".into()),
            release_year: Some(2026),
            status: None,
        };
        let movie = svc.create(&ctx(&["movies:write"]), req).await.unwrap();
        assert_eq!(movie.title, "The Last Encore");
        assert_eq!(movie.synopsis, None);
        assert_eq!(movie.release_year, Some(2026));
        assert_eq!(movie.status, MovieStatus::Draft);
    }

    #[tokio::test]
    async fn invalid_input_is_rejected_before_authorization() {
        let svc = service();
        // Empty title fails the validator; blank title fails normalization. Both run
        // before authz, so a caller without scopes still gets a validation error.
        let err = svc.create(&ctx(&[]), create_req("")).await.unwrap_err();
        assert_eq!(code(err), "VALIDATION_ERROR");
        let err = svc
            .create(&ctx(&["movies:write"]), create_req("   "))
            .await
            .unwrap_err();
        assert_eq!(code(err), "VALIDATION_ERROR");

        let mut req = create_req("Static");
        req.release_year = Some(1500);
        let err = svc.create(&ctx(&["movies:write"]), req).await.unwrap_err();
        assert_eq!(code(err), "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn unknown_movie_is_not_found() {
        let svc = service();
        let c = ctx(&["movies:*"]);
        let err = svc.get(&c, MovieId::generate()).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
        let err = svc.delete(&c, MovieId::generate()).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
        let update = UpdateMovieRequest {
            title: None,
            synopsis: None,
            release_year: None,
            status: Some(MovieStatus::Released),
        };
        let err = svc.update(&c, MovieId::generate(), update).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
    }

    #[tokio::test]
    async fn update_merges_fields_and_clears_synopsis() {
        let svc = service();
        let c = ctx(&["movies:*"]);
        let mut req = create_req("Static");
        req.synopsis = Some("A film about noise".into());
        let created = svc.create(&c, req).await.unwrap();

        let update = UpdateMovieRequest {
            title: Some("  Static II ".into()),
            synopsis: Some(String::new()),
            release_year: Some(2027),
            status: Some(MovieStatus::InProduction),
        };
        let updated = svc.update(&c, created.id, update).await.unwrap();
        assert_eq!(updated.title, "Static II");
        assert_eq!(updated.synopsis, None);
        assert_eq!(updated.release_year, Some(2027));
        assert_eq!(updated.status, MovieStatus::InProduction);
        assert!(updated.updated_at >= created.updated_at);

        // Absent fields are untouched.
        let noop = UpdateMovieRequest {
            title: None,
            synopsis: None,
            release_year: None,
            status: None,
        };
        let same = svc.update(&c, created.id, noop).await.unwrap();
        assert_eq!(same.title, "Static II");
        assert_eq!(same.release_year, Some(2027));
    }

    #[tokio::test]
    async fn list_filters_and_paginates() {
        let svc = service();
        let c = ctx(&["movies:*"]);
        for (title, status) in [
            ("The Last Encore", MovieStatus::InProduction),
            ("Midnight Frequencies", MovieStatus::Released),
            ("Static", MovieStatus::Draft),
        ] {
            let mut req = create_req(title);
            req.status = Some(status);
            svc.create(&c, req).await.unwrap();
        }

        let all = svc
            .list(&c, MovieFilter::default(), PageQuery::default())
            .await
            .unwrap();
        assert_eq!(all.pagination.total, 3);
        assert_eq!(all.items[0].title, "Midnight Frequencies");

        let released = MovieFilter {
            q: None,
            status: Some(MovieStatus::Released),
        };
        let page = svc.list(&c, released, PageQuery::default()).await.unwrap();
        assert_eq!(page.pagination.total, 1);
        assert_eq!(page.items[0].title, "Midnight Frequencies");

        let search = MovieFilter {
            q: Some("  ENCORE ".into()),
            status: None,
        };
        let page = svc.list(&c, search, PageQuery::default()).await.unwrap();
        assert_eq!(page.pagination.total, 1);
        assert_eq!(page.items[0].title, "The Last Encore");

        let second = svc
            .list(&c, MovieFilter::default(), PageQuery { page: 2, page_size: 2 })
            .await
            .unwrap();
        assert_eq!(second.pagination.pages, 2);
        assert_eq!(second.items.len(), 1);
        assert_eq!(second.items[0].title, "The Last Encore");

        let err = svc
            .list(&ctx(&["licenses:read"]), MovieFilter::default(), PageQuery::default())
            .await
            .unwrap_err();
        assert_eq!(code(err), "ACCESS_DENIED");
    }

    #[tokio::test]
    async fn delete_is_blocked_by_active_licenses() {
        let scenes = Arc::new(FakeScenes::default());
        let tracks = Arc::new(FakeTracks::new(scenes.clone()));
        let svc = MovieService::new(Arc::new(FakeRepo::default()), tracks.clone());
        let c = ctx(&["movies:*"]);
        let movie = svc.create(&c, create_req("Static")).await.unwrap();
        let scene = scenes
            .insert(&testing::scene(c.tenant_id, movie.id, "Opening", None))
            .await
            .unwrap()
            .unwrap();
        let now = Utc::now();
        let track = Track {
            id: TrackId::generate(),
            tenant_id: c.tenant_id,
            scene_id: scene.id,
            song_id: tracks.add_song(c.tenant_id, "Velvet Static"),
            start_ms: 0,
            end_ms: 1000,
            usage: TrackUsage::Background,
            created_at: now,
            updated_at: now,
        };
        tracks.insert(&track).await.unwrap();
        tracks.set_license(track.id, LicenseState::Negotiating, None);

        let err = AppError::from(svc.delete(&c, movie.id).await.unwrap_err());
        assert_eq!(
            (err.code(), err.kind().http_status()),
            ("MOVIE_HAS_ACTIVE_LICENSES", 409)
        );
        assert_eq!(err.details()["track_ids"], json!([track.id]));
        assert!(svc.get(&c, movie.id).await.is_ok());

        // `rejected` frees the cue, and with it the movie.
        tracks.set_license(track.id, LicenseState::Rejected, None);
        svc.delete(&c, movie.id).await.unwrap();
        assert_eq!(code(svc.get(&c, movie.id).await.unwrap_err()), "MOVIE_NOT_FOUND");
    }

    #[tokio::test]
    async fn tenants_are_isolated() {
        let svc = service();
        let owner = ctx(&["*"]);
        let created = svc.create(&owner, create_req("Static")).await.unwrap();

        let other = ctx(&["*"]);
        let err = svc.get(&other, created.id).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
        let err = svc.delete(&other, created.id).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
        let page = svc
            .list(&other, MovieFilter::default(), PageQuery::default())
            .await
            .unwrap();
        assert!(page.empty);

        svc.delete(&owner, created.id).await.unwrap();
        let err = svc.get(&owner, created.id).await.unwrap_err();
        assert_eq!(code(err), "MOVIE_NOT_FOUND");
    }
}
