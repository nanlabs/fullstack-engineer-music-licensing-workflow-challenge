use std::sync::Arc;

use chrono::Utc;
use errx::AppError;
use iam::{authz, scopes};
use kernel::{AuthContext, PageQuery, Paginated, SongId};
use validator::Validate;

use super::identifiers::{normalize_isrc, normalize_iswc, normalize_optional_with};
use super::port::SongRepository;
use super::{
    check_duration, check_release_year, CreateSongRequest, Song, SongError, SongFilter, SongResponse, UpdateSongRequest,
};
use crate::text::{normalize_optional, normalize_optional_email, normalize_required};

/// Song use cases. Authorization happens here, before any repository call;
/// identifiers, e-mail and ranges are normalized and checked here too so
/// creation and partial updates apply exactly the same rules.
pub struct SongService {
    repo: Arc<dyn SongRepository>,
}

impl SongService {
    pub fn new(repo: Arc<dyn SongRepository>) -> Self {
        Self { repo }
    }

    pub async fn list(
        &self,
        ctx: &AuthContext,
        filter: SongFilter,
        page: PageQuery,
    ) -> Result<Paginated<SongResponse>, SongError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let page = page.normalized();
        let (songs, total) = self.repo.list(ctx.tenant_id, &filter, page).await?;
        let items = songs.iter().map(SongResponse::from).collect();
        Ok(Paginated::new(items, page, total))
    }

    pub async fn get(&self, ctx: &AuthContext, id: SongId) -> Result<SongResponse, SongError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_READ)?;
        let song = self.load(ctx, id).await?;
        Ok(SongResponse::from(&song))
    }

    pub async fn create(&self, ctx: &AuthContext, req: CreateSongRequest) -> Result<SongResponse, SongError> {
        req.validate().map_err(AppError::from)?;
        check_release_year(req.release_year)?;
        check_duration(req.duration_ms)?;
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let now = Utc::now();
        let song = Song {
            id: SongId::generate(),
            tenant_id: ctx.tenant_id,
            title: normalize_required(&req.title, "title")?,
            artist: normalize_required(&req.artist, "artist")?,
            album: normalize_optional(req.album),
            release_year: req.release_year,
            duration_ms: req.duration_ms,
            isrc: normalize_optional_with(req.isrc, normalize_isrc)?,
            iswc: normalize_optional_with(req.iswc, normalize_iswc)?,
            rights_holder: normalize_required(&req.rights_holder, "rights_holder")?,
            rights_holder_kind: req.rights_holder_kind,
            rights_holder_email: normalize_optional_email(req.rights_holder_email, "rights_holder_email")?,
            notes: normalize_optional(req.notes),
            created_at: now,
            updated_at: now,
        };
        self.repo.insert(&song).await?;
        Ok(SongResponse::from(&song))
    }

    pub async fn update(
        &self,
        ctx: &AuthContext,
        id: SongId,
        req: UpdateSongRequest,
    ) -> Result<SongResponse, SongError> {
        req.validate().map_err(AppError::from)?;
        if let Some(year) = req.release_year {
            check_release_year(year)?;
        }
        if let Some(duration) = req.duration_ms {
            check_duration(duration)?;
        }
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;

        let mut song = self.load(ctx, id).await?;
        if let Some(title) = req.title {
            song.title = normalize_required(&title, "title")?;
        }
        if let Some(artist) = req.artist {
            song.artist = normalize_required(&artist, "artist")?;
        }
        if let Some(album) = req.album {
            song.album = normalize_optional(Some(album));
        }
        if let Some(year) = req.release_year {
            song.release_year = year;
        }
        if let Some(duration) = req.duration_ms {
            song.duration_ms = duration;
        }
        if let Some(isrc) = req.isrc {
            song.isrc = normalize_optional_with(Some(isrc), normalize_isrc)?;
        }
        if let Some(iswc) = req.iswc {
            song.iswc = normalize_optional_with(Some(iswc), normalize_iswc)?;
        }
        if let Some(holder) = req.rights_holder {
            song.rights_holder = normalize_required(&holder, "rights_holder")?;
        }
        if let Some(kind) = req.rights_holder_kind {
            song.rights_holder_kind = kind;
        }
        if let Some(email) = req.rights_holder_email {
            song.rights_holder_email = normalize_optional_email(Some(email), "rights_holder_email")?;
        }
        if let Some(notes) = req.notes {
            song.notes = normalize_optional(Some(notes));
        }
        song.updated_at = Utc::now();
        let song = self.repo.update(&song).await?.ok_or(SongError::NotFound)?;
        Ok(SongResponse::from(&song))
    }

    pub async fn delete(&self, ctx: &AuthContext, id: SongId) -> Result<(), SongError> {
        authz::require(ctx, ctx.tenant_id, scopes::MOVIES_WRITE)?;
        if self.repo.delete(ctx.tenant_id, id).await? {
            Ok(())
        } else {
            Err(SongError::NotFound)
        }
    }

    async fn load(&self, ctx: &AuthContext, id: SongId) -> Result<Song, SongError> {
        self.repo.get(ctx.tenant_id, id).await?.ok_or(SongError::NotFound)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use async_trait::async_trait;
    use errx::AppResult;
    use kernel::{Actor, TenantId, UserId};
    use serde_json::json;

    use super::*;
    use crate::song::RightsHolderKind;

    /// In-memory port with the two database invariants the adapter enforces:
    /// one ISRC per tenant and no delete while a track references the song.
    #[derive(Default)]
    struct FakeRepo {
        rows: Mutex<Vec<Song>>,
        in_use: Mutex<Vec<SongId>>,
    }

    impl FakeRepo {
        fn isrc_taken(rows: &[Song], song: &Song) -> bool {
            song.isrc.as_deref().is_some_and(|isrc| {
                rows.iter()
                    .any(|s| s.tenant_id == song.tenant_id && s.id != song.id && s.isrc.as_deref() == Some(isrc))
            })
        }
    }

    #[async_trait]
    impl SongRepository for FakeRepo {
        async fn get(&self, tenant_id: TenantId, id: SongId) -> AppResult<Option<Song>> {
            Ok(self
                .rows
                .lock()
                .unwrap()
                .iter()
                .find(|s| s.tenant_id == tenant_id && s.id == id)
                .cloned())
        }

        async fn list(&self, tenant_id: TenantId, filter: &SongFilter, page: PageQuery) -> AppResult<(Vec<Song>, u64)> {
            let term = filter.term().map(str::to_lowercase);
            let mut matching: Vec<Song> = self
                .rows
                .lock()
                .unwrap()
                .iter()
                .filter(|s| s.tenant_id == tenant_id)
                .filter(|s| {
                    term.as_ref()
                        .is_none_or(|q| s.title.to_lowercase().contains(q) || s.artist.to_lowercase().contains(q))
                })
                .cloned()
                .collect();
            matching.sort_by_key(|s| s.title.to_lowercase());
            let total = matching.len() as u64;
            let items = matching
                .into_iter()
                .skip(page.offset() as usize)
                .take(page.limit() as usize)
                .collect();
            Ok((items, total))
        }

        async fn insert(&self, song: &Song) -> Result<(), SongError> {
            let mut rows = self.rows.lock().unwrap();
            if Self::isrc_taken(&rows, song) {
                return Err(SongError::IsrcTaken);
            }
            rows.push(song.clone());
            Ok(())
        }

        async fn update(&self, song: &Song) -> Result<Option<Song>, SongError> {
            let mut rows = self.rows.lock().unwrap();
            if Self::isrc_taken(&rows, song) {
                return Err(SongError::IsrcTaken);
            }
            match rows
                .iter_mut()
                .find(|s| s.tenant_id == song.tenant_id && s.id == song.id)
            {
                Some(row) => {
                    *row = song.clone();
                    Ok(Some(song.clone()))
                }
                None => Ok(None),
            }
        }

        async fn delete(&self, tenant_id: TenantId, id: SongId) -> Result<bool, SongError> {
            let mut rows = self.rows.lock().unwrap();
            let exists = rows.iter().any(|s| s.tenant_id == tenant_id && s.id == id);
            if exists && self.in_use.lock().unwrap().contains(&id) {
                return Err(SongError::InUse);
            }
            let before = rows.len();
            rows.retain(|s| !(s.tenant_id == tenant_id && s.id == id));
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

    fn service() -> (SongService, Arc<FakeRepo>) {
        let repo = Arc::new(FakeRepo::default());
        (SongService::new(repo.clone()), repo)
    }

    fn create_req(title: &str, artist: &str) -> CreateSongRequest {
        CreateSongRequest {
            title: title.to_owned(),
            artist: artist.to_owned(),
            album: None,
            release_year: None,
            duration_ms: None,
            isrc: None,
            iswc: None,
            rights_holder: "Harbor Lane Records".to_owned(),
            rights_holder_kind: None,
            rights_holder_email: None,
            notes: None,
        }
    }

    fn with_isrc(mut req: CreateSongRequest, isrc: &str) -> CreateSongRequest {
        req.isrc = Some(isrc.to_owned());
        req
    }

    fn update_req(body: serde_json::Value) -> UpdateSongRequest {
        serde_json::from_value(body).unwrap()
    }

    fn code(err: SongError) -> String {
        AppError::from(err).code().to_owned()
    }

    fn field(err: SongError) -> String {
        AppError::from(err).details()["field"].as_str().unwrap().to_owned()
    }

    #[tokio::test]
    async fn create_requires_write_scope() {
        let (svc, _) = service();
        let err = svc
            .create(&ctx(&["movies:read"]), create_req("Velvet Static", "The Marrow Lights"))
            .await
            .unwrap_err();
        let err = AppError::from(err);
        assert_eq!(err.code(), "ACCESS_DENIED");
        assert_eq!(err.details()["required_scope"], "movies:write");

        assert!(svc
            .create(&ctx(&["movies:*"]), create_req("Velvet Static", "The Marrow Lights"))
            .await
            .is_ok());
        assert!(svc
            .create(&ctx(&["*"]), create_req("Velvet Static", "The Marrow Lights"))
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn create_normalizes_identifiers_and_text() {
        let (svc, _) = service();
        let req = CreateSongRequest {
            title: "  Velvet Static ".into(),
            artist: " The Marrow Lights  ".into(),
            album: Some("   ".into()),
            release_year: Some(2023),
            duration_ms: Some(214000),
            isrc: Some("gb-aaa-24-00001".into()),
            iswc: Some(" t-034.524.680-1 ".into()),
            rights_holder: " Harbor Lane Records ".into(),
            rights_holder_kind: Some(RightsHolderKind::Label),
            rights_holder_email: Some("  licensing@harborlane.test ".into()),
            notes: Some("".into()),
        };
        let song = svc.create(&ctx(&["movies:write"]), req).await.unwrap();
        assert_eq!(song.title, "Velvet Static");
        assert_eq!(song.artist, "The Marrow Lights");
        assert_eq!(song.album, None);
        assert_eq!(song.release_year, Some(2023));
        assert_eq!(song.duration_ms, Some(214000));
        assert_eq!(song.isrc.as_deref(), Some("GBAAA2400001"));
        assert_eq!(song.iswc.as_deref(), Some("T0345246801"));
        assert_eq!(song.rights_holder, "Harbor Lane Records");
        assert_eq!(song.rights_holder_kind, Some(RightsHolderKind::Label));
        assert_eq!(song.rights_holder_email.as_deref(), Some("licensing@harborlane.test"));
        assert_eq!(song.notes, None);
    }

    #[tokio::test]
    async fn invalid_identifiers_email_and_ranges_are_validation_errors() {
        let (svc, _) = service();
        let c = ctx(&["movies:write"]);

        let err = svc
            .create(&c, with_isrc(create_req("X", "Y"), "GBAAA24000"))
            .await
            .unwrap_err();
        assert_eq!(field(err), "isrc");

        let mut req = create_req("X", "Y");
        req.iswc = Some("T-034.524.680-2".into());
        assert_eq!(field(svc.create(&c, req).await.unwrap_err()), "iswc");

        let mut req = create_req("X", "Y");
        req.rights_holder_email = Some("nope".into());
        assert_eq!(field(svc.create(&c, req).await.unwrap_err()), "rights_holder_email");

        let mut req = create_req("X", "Y");
        req.rights_holder = "   ".into();
        assert_eq!(field(svc.create(&c, req).await.unwrap_err()), "rights_holder");

        // Ranges are checked before authorization, like lengths.
        let mut req = create_req("X", "Y");
        req.duration_ms = Some(0);
        let err = svc.create(&ctx(&[]), req).await.unwrap_err();
        assert_eq!(code(err), "VALIDATION_ERROR");
        let mut req = create_req("X", "Y");
        req.release_year = Some(1800);
        assert_eq!(field(svc.create(&ctx(&[]), req).await.unwrap_err()), "release_year");
        let err = svc.create(&ctx(&[]), create_req("", "Y")).await.unwrap_err();
        assert_eq!(code(err), "VALIDATION_ERROR");
    }

    #[tokio::test]
    async fn duplicate_isrc_is_conflict_within_tenant_only() {
        let (svc, _) = service();
        let acme = ctx(&["*"]);
        let other = ctx(&["*"]);

        svc.create(
            &acme,
            with_isrc(create_req("Velvet Static", "The Marrow Lights"), "QZACM2300017"),
        )
        .await
        .unwrap();
        let err = svc
            .create(
                &acme,
                with_isrc(
                    create_req("Velvet Static (Live)", "The Marrow Lights"),
                    "qz-acm-23-00017",
                ),
            )
            .await
            .unwrap_err();
        assert_eq!(code(err), "SONG_ISRC_TAKEN");
        // Same ISRC in another tenant, and songs without ISRC, are fine.
        svc.create(
            &other,
            with_isrc(create_req("Velvet Static", "The Marrow Lights"), "QZACM2300017"),
        )
        .await
        .unwrap();
        svc.create(&acme, create_req("Paper Moons", "Orla & the Tides"))
            .await
            .unwrap();
        svc.create(&acme, create_req("Paper Moons", "Orla & the Tides"))
            .await
            .unwrap();

        // Updating into a taken ISRC conflicts too.
        let free = svc
            .create(&acme, create_req("Frequency Drift", "Nocturne Radio"))
            .await
            .unwrap();
        let err = svc
            .update(&acme, free.id, update_req(json!({ "isrc": "QZACM2300017" })))
            .await
            .unwrap_err();
        assert_eq!(code(err), "SONG_ISRC_TAKEN");
    }

    #[tokio::test]
    async fn update_merges_and_clears_optional_fields() {
        let (svc, _) = service();
        let c = ctx(&["*"]);
        let mut req = with_isrc(create_req("Velvet Static", "The Marrow Lights"), "QZACM2300017");
        req.album = Some("Night Signals".into());
        req.duration_ms = Some(214000);
        req.release_year = Some(2023);
        req.rights_holder_kind = Some(RightsHolderKind::Label);
        req.rights_holder_email = Some("licensing@harborlane.test".into());
        let created = svc.create(&c, req).await.unwrap();

        let patch = json!({
            "album": "",
            "isrc": "",
            "duration_ms": null,
            "rights_holder_kind": null,
            "rights_holder_email": "",
            "notes": "  Clean edit available  "
        });
        let updated = svc.update(&c, created.id, update_req(patch)).await.unwrap();
        assert_eq!(updated.title, "Velvet Static");
        assert_eq!(updated.album, None);
        assert_eq!(updated.isrc, None);
        assert_eq!(updated.duration_ms, None);
        assert_eq!(updated.release_year, Some(2023));
        assert_eq!(updated.rights_holder_kind, None);
        assert_eq!(updated.rights_holder_email, None);
        assert_eq!(updated.notes.as_deref(), Some("Clean edit available"));
        assert!(updated.updated_at >= created.updated_at);

        // Absent fields are untouched; values are normalized on the way in.
        let patch = json!({ "iswc": "T-034.524.680-1", "rights_holder_kind": "publisher", "release_year": 2024 });
        let again = svc.update(&c, created.id, update_req(patch)).await.unwrap();
        assert_eq!(again.notes.as_deref(), Some("Clean edit available"));
        assert_eq!(again.iswc.as_deref(), Some("T0345246801"));
        assert_eq!(again.rights_holder_kind, Some(RightsHolderKind::Publisher));
        assert_eq!(again.release_year, Some(2024));

        let err = svc
            .update(&c, created.id, update_req(json!({ "duration_ms": -1 })))
            .await
            .unwrap_err();
        assert_eq!(field(err), "duration_ms");
        let err = svc
            .update(&c, SongId::generate(), update_req(json!({ "title": "Ghost" })))
            .await
            .unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
    }

    #[tokio::test]
    async fn list_matches_title_or_artist_and_paginates() {
        let (svc, _) = service();
        let c = ctx(&["*"]);
        for (title, artist) in [
            ("Velvet Static", "The Marrow Lights"),
            ("Last Call at the Blue Room", "Ines Calder"),
            ("Frequency Drift", "Nocturne Radio"),
        ] {
            svc.create(&c, create_req(title, artist)).await.unwrap();
        }

        let all = svc.list(&c, SongFilter::default(), PageQuery::default()).await.unwrap();
        assert_eq!(all.pagination.total, 3);
        assert_eq!(all.items[0].title, "Frequency Drift");

        let by_artist = SongFilter {
            q: Some("  MARROW ".into()),
        };
        let page = svc.list(&c, by_artist, PageQuery::default()).await.unwrap();
        assert_eq!(page.pagination.total, 1);
        assert_eq!(page.items[0].title, "Velvet Static");

        let by_title = SongFilter {
            q: Some("blue room".into()),
        };
        let page = svc.list(&c, by_title, PageQuery::default()).await.unwrap();
        assert_eq!(page.pagination.total, 1);
        assert_eq!(page.items[0].artist, "Ines Calder");

        let second = svc
            .list(&c, SongFilter::default(), PageQuery { page: 2, page_size: 2 })
            .await
            .unwrap();
        assert_eq!(second.pagination.pages, 2);
        assert_eq!(second.items.len(), 1);
        assert_eq!(second.items[0].title, "Velvet Static");

        let err = svc
            .list(&ctx(&["licenses:read"]), SongFilter::default(), PageQuery::default())
            .await
            .unwrap_err();
        assert_eq!(code(err), "ACCESS_DENIED");
    }

    #[tokio::test]
    async fn delete_in_use_is_conflict() {
        let (svc, repo) = service();
        let c = ctx(&["*"]);
        let song = svc
            .create(&c, create_req("Velvet Static", "The Marrow Lights"))
            .await
            .unwrap();

        repo.in_use.lock().unwrap().push(song.id);
        let err = svc.delete(&c, song.id).await.unwrap_err();
        assert_eq!(code(err), "SONG_IN_USE");
        assert!(svc.get(&c, song.id).await.is_ok());

        repo.in_use.lock().unwrap().clear();
        svc.delete(&c, song.id).await.unwrap();
        let err = svc.delete(&c, song.id).await.unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
    }

    #[tokio::test]
    async fn tenants_are_isolated() {
        let (svc, _) = service();
        let owner = ctx(&["*"]);
        let created = svc
            .create(&owner, create_req("Velvet Static", "The Marrow Lights"))
            .await
            .unwrap();

        let other = ctx(&["*"]);
        let err = svc.get(&other, created.id).await.unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
        let err = svc
            .update(&other, created.id, update_req(json!({ "title": "Mine now" })))
            .await
            .unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
        let err = svc.delete(&other, created.id).await.unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
        let page = svc
            .list(&other, SongFilter::default(), PageQuery::default())
            .await
            .unwrap();
        assert!(page.empty);

        svc.delete(&owner, created.id).await.unwrap();
        let err = svc.get(&owner, created.id).await.unwrap_err();
        assert_eq!(code(err), "SONG_NOT_FOUND");
    }
}
