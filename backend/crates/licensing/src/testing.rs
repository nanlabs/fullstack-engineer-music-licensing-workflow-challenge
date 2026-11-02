//! In-memory fakes shared by the service unit tests of this crate. Each one
//! implements a port over a `Mutex<Vec<_>>` and reproduces only the
//! semantics the services rely on: tenant filtering, server-assigned
//! positions, the joins behind the track view, the foreign key on songs,
//! the license guard of track writes, the version guard of license
//! transitions and the tenant-wide position of their events. `FakeTracks` serves both the track and the license
//! ports, the way the two tables live together in the real database.

use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use errx::{AppError, AppResult};
use kernel::{Actor, AuthContext, MovieId, PageQuery, SceneId, SongId, TenantId, TrackId, UserId};

use crate::license::port::{EventPublisher, LicenseRepository};
use crate::license::{
    EventSource, License, LicenseChanged, LicenseEvent, LicenseEventKind, LicenseState, LicenseSummary,
};
use crate::movie::port::MovieRepository;
use crate::movie::{Movie, MovieFilter, MovieStatus};
use crate::scene::port::SceneRepository;
use crate::scene::{Scene, SceneError};
use crate::track::port::TrackRepository;
use crate::track::{SongSummary, Track, TrackError, TrackResponse, TrackUsage, TrackView};

/// A request context of `tenant_id` holding `scopes`.
pub fn ctx(tenant_id: TenantId, scopes: &[&str]) -> AuthContext {
    ctx_named(tenant_id, scopes, None)
}

/// Like [`ctx`], with the display name the middleware would carry.
pub fn ctx_named(tenant_id: TenantId, scopes: &[&str], name: Option<&str>) -> AuthContext {
    AuthContext {
        actor: Actor::user(UserId::generate()),
        tenant_id,
        session_id: None,
        email: None,
        name: name.map(str::to_owned),
        scopes: scopes.iter().map(|s| s.to_string()).collect(),
    }
}

/// A draft movie of the tenant.
pub fn movie(tenant_id: TenantId, title: &str) -> Movie {
    let now = Utc::now();
    Movie {
        id: MovieId::generate(),
        tenant_id,
        title: title.to_owned(),
        synopsis: None,
        release_year: None,
        status: MovieStatus::Draft,
        created_at: now,
        updated_at: now,
    }
}

/// A scene of `movie_id` with an optional window; `position` is assigned by
/// [`FakeScenes::insert`].
pub fn scene(tenant_id: TenantId, movie_id: MovieId, title: &str, window: Option<(i32, i32)>) -> Scene {
    let now = Utc::now();
    Scene {
        id: SceneId::generate(),
        tenant_id,
        movie_id,
        position: 0,
        title: title.to_owned(),
        description: None,
        start_ms: window.map(|w| w.0),
        end_ms: window.map(|w| w.1),
        created_at: now,
        updated_at: now,
    }
}

/// A published change at `position` for a random tenant (bus and stream tests).
pub fn changed(position: i64) -> LicenseChanged {
    changed_in(TenantId::generate(), position)
}

/// A published change at `position`: a `request` on a fresh track of `tenant_id`.
pub fn changed_in(tenant_id: TenantId, position: i64) -> LicenseChanged {
    let now = Utc::now();
    let track_id = TrackId::generate();
    LicenseChanged {
        position,
        tenant_id,
        event: LicenseEventKind::Request,
        from_state: LicenseState::Pending,
        to_state: LicenseState::Requested,
        source: EventSource::Acme,
        seq: 1,
        occurred_at: now,
        track: TrackResponse {
            id: track_id,
            tenant_id,
            movie_id: MovieId::generate(),
            scene_id: SceneId::generate(),
            song: SongSummary {
                id: SongId::generate(),
                title: "Velvet Static".to_owned(),
                artist: "Fake Artist".to_owned(),
                rights_holder: "Fake Holder".to_owned(),
            },
            start_ms: 0,
            end_ms: 1000,
            duration_ms: 1000,
            usage: TrackUsage::Background,
            created_at: now,
            updated_at: now,
            license: LicenseSummary {
                state: LicenseState::Requested,
                updated_at: now,
                expires_at: None,
                allowed_events: vec![LicenseEventKind::StartNegotiation, LicenseEventKind::Reject],
            },
        },
    }
}

/// A publisher whose transport is down.
pub struct FailingPublisher;

#[async_trait]
impl EventPublisher for FailingPublisher {
    async fn publish(&self, _event: LicenseChanged) -> AppResult<()> {
        Err(AppError::internal("event transport is down"))
    }
}

#[derive(Default)]
pub struct FakeMovies {
    pub rows: Mutex<Vec<Movie>>,
}

#[async_trait]
impl MovieRepository for FakeMovies {
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
        _tenant_id: TenantId,
        _filter: &MovieFilter,
        _page: PageQuery,
    ) -> AppResult<(Vec<Movie>, u64)> {
        unreachable!("child services never list movies")
    }

    async fn insert(&self, movie: &Movie) -> AppResult<()> {
        self.rows.lock().unwrap().push(movie.clone());
        Ok(())
    }

    async fn update(&self, _movie: &Movie) -> AppResult<Option<Movie>> {
        unreachable!("child services never update movies")
    }

    async fn delete(&self, _tenant_id: TenantId, _id: MovieId) -> AppResult<bool> {
        unreachable!("child services never delete movies")
    }
}

#[derive(Default)]
pub struct FakeScenes {
    pub rows: Mutex<Vec<Scene>>,
}

#[async_trait]
impl SceneRepository for FakeScenes {
    async fn get(&self, tenant_id: TenantId, id: SceneId) -> AppResult<Option<Scene>> {
        Ok(self
            .rows
            .lock()
            .unwrap()
            .iter()
            .find(|s| s.tenant_id == tenant_id && s.id == id)
            .cloned())
    }

    async fn list_by_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<Scene>> {
        let mut scenes: Vec<Scene> = self
            .rows
            .lock()
            .unwrap()
            .iter()
            .filter(|s| s.tenant_id == tenant_id && s.movie_id == movie_id)
            .cloned()
            .collect();
        scenes.sort_by_key(|s| (s.position, s.id));
        Ok(scenes)
    }

    async fn insert(&self, scene: &Scene) -> AppResult<Option<Scene>> {
        let mut rows = self.rows.lock().unwrap();
        let next = rows
            .iter()
            .filter(|s| s.movie_id == scene.movie_id)
            .map(|s| s.position)
            .max()
            .unwrap_or(0)
            + 1;
        let stored = Scene {
            position: next,
            ..scene.clone()
        };
        rows.push(stored.clone());
        Ok(Some(stored))
    }

    async fn update(&self, scene: &Scene) -> AppResult<Option<Scene>> {
        let mut rows = self.rows.lock().unwrap();
        match rows
            .iter_mut()
            .find(|s| s.tenant_id == scene.tenant_id && s.id == scene.id)
        {
            Some(row) => {
                let position = row.position;
                *row = Scene {
                    position,
                    ..scene.clone()
                };
                Ok(Some(row.clone()))
            }
            None => Ok(None),
        }
    }

    async fn delete(&self, tenant_id: TenantId, id: SceneId) -> AppResult<bool> {
        let mut rows = self.rows.lock().unwrap();
        let before = rows.len();
        rows.retain(|s| !(s.tenant_id == tenant_id && s.id == id));
        Ok(rows.len() < before)
    }

    async fn reorder(&self, tenant_id: TenantId, movie_id: MovieId, ids: &[SceneId]) -> AppResult<Option<Vec<Scene>>> {
        let mut rows = self.rows.lock().unwrap();
        for (index, id) in ids.iter().enumerate() {
            if let Some(row) = rows
                .iter_mut()
                .find(|s| s.tenant_id == tenant_id && s.movie_id == movie_id && s.id == *id)
            {
                row.position = index as i32 + 1;
            }
        }
        let mut scenes: Vec<Scene> = rows
            .iter()
            .filter(|s| s.tenant_id == tenant_id && s.movie_id == movie_id)
            .cloned()
            .collect();
        scenes.sort_by_key(|s| s.position);
        Ok(Some(scenes))
    }
}

/// Tracks plus the songs each tenant owns (so writes reject an unknown song
/// the way the foreign key does), the scenes that resolve `movie_id` for
/// the view, and the licenses, events and published changes of those tracks.
pub struct FakeTracks {
    pub rows: Mutex<Vec<Track>>,
    pub songs: Mutex<Vec<(TenantId, SongSummary)>>,
    pub licenses: Mutex<Vec<License>>,
    pub events: Mutex<Vec<LicenseEvent>>,
    /// What `changes_since` replays: one entry per applied event, in
    /// position order, with the track view at apply time.
    pub changes: Mutex<Vec<LicenseChanged>>,
    /// When set, the next `apply` reports a lost race (version moved).
    pub fail_next_apply: Mutex<bool>,
    /// When set, the next guarded write (`update` or `delete`) first moves
    /// the track's license to this state, as a transition committing between
    /// the service's check and the write would, and then applies the guard.
    pub race_license: Mutex<Option<LicenseState>>,
    next_position: AtomicI64,
    scenes: Arc<FakeScenes>,
}

impl FakeTracks {
    pub fn new(scenes: Arc<FakeScenes>) -> Self {
        Self {
            rows: Mutex::default(),
            songs: Mutex::default(),
            licenses: Mutex::default(),
            events: Mutex::default(),
            changes: Mutex::default(),
            fail_next_apply: Mutex::new(false),
            race_license: Mutex::new(None),
            next_position: AtomicI64::new(1),
            scenes,
        }
    }

    /// Puts a license in `state` directly (what a seed does in the database).
    pub fn set_license(&self, track_id: TrackId, state: LicenseState, expires_at: Option<DateTime<Utc>>) {
        let mut licenses = self.licenses.lock().unwrap();
        let license = licenses
            .iter_mut()
            .find(|l| l.track_id == track_id)
            .expect("every track has a license");
        license.state = state;
        license.expires_at = expires_at;
        license.updated_at = Utc::now();
    }

    /// The stored license of a track, for assertions.
    pub fn license_of_test(&self, track_id: TrackId) -> License {
        self.license_of(track_id)
    }

    fn license_of(&self, track_id: TrackId) -> License {
        self.licenses
            .lock()
            .unwrap()
            .iter()
            .find(|l| l.track_id == track_id)
            .cloned()
            .expect("every track has a license")
    }

    /// Registers a song of the tenant and returns its id.
    pub fn add_song(&self, tenant_id: TenantId, title: &str) -> SongId {
        let summary = SongSummary {
            id: SongId::generate(),
            title: title.to_owned(),
            artist: "Fake Artist".to_owned(),
            rights_holder: "Fake Holder".to_owned(),
        };
        let id = summary.id;
        self.songs.lock().unwrap().push((tenant_id, summary));
        id
    }

    fn song_of(&self, track: &Track) -> Option<SongSummary> {
        self.songs
            .lock()
            .unwrap()
            .iter()
            .find(|(tenant, song)| *tenant == track.tenant_id && song.id == track.song_id)
            .map(|(_, song)| song.clone())
    }

    /// `None` when the scene or the song is not in the track's tenant.
    fn view(&self, track: &Track) -> Option<TrackView> {
        let movie_id = self
            .scenes
            .rows
            .lock()
            .unwrap()
            .iter()
            .find(|s| s.tenant_id == track.tenant_id && s.id == track.scene_id)
            .map(|s| s.movie_id)?;
        let song = self.song_of(track)?;
        Some(TrackView {
            track: track.clone(),
            movie_id,
            song,
            license: self.license_of(track.id),
        })
    }

    /// The guard of the real adapter's `UPDATE`/`DELETE`: true while the
    /// track's license is active (after the simulated race, if any).
    fn locked(&self, track_id: TrackId) -> bool {
        if let Some(state) = self.race_license.lock().unwrap().take() {
            self.set_license(track_id, state, None);
        }
        self.licenses
            .lock()
            .unwrap()
            .iter()
            .any(|l| l.track_id == track_id && l.state.is_active())
    }

    fn matches(view: &TrackView, state: Option<LicenseState>) -> bool {
        state.is_none_or(|s| view.license.state == s)
    }

    fn sorted(mut tracks: Vec<Track>) -> Vec<Track> {
        tracks.sort_by_key(|t| (t.start_ms, t.end_ms, t.id));
        tracks
    }

    fn in_scene(&self, tenant_id: TenantId, scene_id: SceneId) -> Vec<Track> {
        let tracks = self
            .rows
            .lock()
            .unwrap()
            .iter()
            .filter(|t| t.tenant_id == tenant_id && t.scene_id == scene_id)
            .cloned()
            .collect();
        Self::sorted(tracks)
    }
}

#[async_trait]
impl TrackRepository for FakeTracks {
    async fn get(&self, tenant_id: TenantId, id: TrackId) -> AppResult<Option<TrackView>> {
        let track = self
            .rows
            .lock()
            .unwrap()
            .iter()
            .find(|t| t.tenant_id == tenant_id && t.id == id)
            .cloned();
        Ok(track.and_then(|t| self.view(&t)))
    }

    async fn list_by_scene(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>> {
        Ok(self
            .in_scene(tenant_id, scene_id)
            .iter()
            .filter_map(|t| self.view(t))
            .filter(|v| Self::matches(v, state))
            .collect())
    }

    async fn list_by_movie(
        &self,
        tenant_id: TenantId,
        movie_id: MovieId,
        state: Option<LicenseState>,
    ) -> AppResult<Vec<TrackView>> {
        let mut views = Vec::new();
        for scene in self.scenes.list_by_movie(tenant_id, movie_id).await? {
            views.extend(self.list_by_scene(tenant_id, scene.id, state).await?);
        }
        Ok(views)
    }

    async fn insert(&self, track: &Track) -> Result<TrackView, TrackError> {
        if self.song_of(track).is_none() {
            return Err(TrackError::UnknownSong);
        }
        self.licenses
            .lock()
            .unwrap()
            .push(License::pending(track.id, track.tenant_id, track.created_at));
        let Some(view) = self.view(track) else {
            self.licenses.lock().unwrap().retain(|l| l.track_id != track.id);
            return Err(TrackError::Scene(SceneError::NotFound));
        };
        self.rows.lock().unwrap().push(track.clone());
        Ok(view)
    }

    async fn update(&self, track: &Track) -> Result<Option<TrackView>, TrackError> {
        if self.locked(track.id) {
            return Ok(None);
        }
        if self.song_of(track).is_none() {
            return Err(TrackError::UnknownSong);
        }
        let stored = {
            let mut rows = self.rows.lock().unwrap();
            let Some(row) = rows
                .iter_mut()
                .find(|t| t.tenant_id == track.tenant_id && t.id == track.id)
            else {
                return Ok(None);
            };
            *row = track.clone();
            row.clone()
        };
        Ok(self.view(&stored))
    }

    async fn delete(&self, tenant_id: TenantId, id: TrackId) -> AppResult<bool> {
        if self.locked(id) {
            return Ok(false);
        }
        let mut rows = self.rows.lock().unwrap();
        let before = rows.len();
        rows.retain(|t| !(t.tenant_id == tenant_id && t.id == id));
        if rows.len() < before {
            self.licenses.lock().unwrap().retain(|l| l.track_id != id);
            self.events.lock().unwrap().retain(|e| e.track_id != id);
            self.changes.lock().unwrap().retain(|c| c.track.id != id);
            return Ok(true);
        }
        Ok(false)
    }

    async fn locked_in_scene(&self, tenant_id: TenantId, scene_id: SceneId) -> AppResult<Vec<TrackId>> {
        let licenses = self.licenses.lock().unwrap();
        Ok(self
            .in_scene(tenant_id, scene_id)
            .into_iter()
            .filter(|t| licenses.iter().any(|l| l.track_id == t.id && l.state.is_active()))
            .map(|t| t.id)
            .collect())
    }

    async fn locked_in_movie(&self, tenant_id: TenantId, movie_id: MovieId) -> AppResult<Vec<TrackId>> {
        let mut ids = Vec::new();
        for scene in self.scenes.list_by_movie(tenant_id, movie_id).await? {
            ids.extend(self.locked_in_scene(tenant_id, scene.id).await?);
        }
        Ok(ids)
    }

    async fn outside_window(
        &self,
        tenant_id: TenantId,
        scene_id: SceneId,
        start_ms: i32,
        end_ms: i32,
    ) -> AppResult<Vec<TrackId>> {
        Ok(self
            .in_scene(tenant_id, scene_id)
            .into_iter()
            .filter(|t| t.start_ms < start_ms || t.end_ms > end_ms)
            .map(|t| t.id)
            .collect())
    }
}

#[async_trait]
impl LicenseRepository for FakeTracks {
    async fn apply(&self, license: &License, event: &LicenseEvent) -> AppResult<Option<i64>> {
        if std::mem::take(&mut *self.fail_next_apply.lock().unwrap()) {
            return Ok(None);
        }
        let position = {
            let mut licenses = self.licenses.lock().unwrap();
            let Some(row) = licenses
                .iter_mut()
                .find(|l| l.tenant_id == license.tenant_id && l.track_id == license.track_id)
            else {
                return Ok(None);
            };
            if row.version + 1 != license.version {
                return Ok(None);
            }
            *row = license.clone();
            self.next_position.fetch_add(1, Ordering::SeqCst)
        };
        self.events.lock().unwrap().push(event.clone());
        // The view is built after the license lock is released (it reads
        // the licenses again).
        let track = self
            .rows
            .lock()
            .unwrap()
            .iter()
            .find(|t| t.tenant_id == license.tenant_id && t.id == license.track_id)
            .cloned();
        if let Some(view) = track.and_then(|t| self.view(&t)) {
            self.changes.lock().unwrap().push(LicenseChanged {
                position,
                tenant_id: event.tenant_id,
                event: event.kind,
                from_state: event.from_state,
                to_state: event.to_state,
                source: event.source,
                seq: event.seq,
                occurred_at: event.created_at,
                track: TrackResponse::from(&view),
            });
        }
        Ok(Some(position))
    }

    async fn list_events(&self, tenant_id: TenantId, track_id: TrackId) -> AppResult<Vec<LicenseEvent>> {
        let mut events: Vec<LicenseEvent> = self
            .events
            .lock()
            .unwrap()
            .iter()
            .filter(|e| e.tenant_id == tenant_id && e.track_id == track_id)
            .cloned()
            .collect();
        events.sort_by_key(|e| e.seq);
        Ok(events)
    }

    async fn head_position(&self, tenant_id: TenantId) -> AppResult<i64> {
        Ok(self
            .changes
            .lock()
            .unwrap()
            .iter()
            .filter(|c| c.tenant_id == tenant_id)
            .map(|c| c.position)
            .max()
            .unwrap_or(0))
    }

    async fn changes_since(&self, tenant_id: TenantId, after: i64, limit: i64) -> AppResult<Vec<LicenseChanged>> {
        let mut changes: Vec<LicenseChanged> = self
            .changes
            .lock()
            .unwrap()
            .iter()
            .filter(|c| c.tenant_id == tenant_id && c.position > after)
            .cloned()
            .collect();
        changes.sort_by_key(|c| c.position);
        changes.truncate(limit as usize);
        Ok(changes)
    }

    async fn due_for_expiry(&self, now: DateTime<Utc>, limit: i64) -> AppResult<Vec<License>> {
        let mut due: Vec<License> = self
            .licenses
            .lock()
            .unwrap()
            .iter()
            .filter(|l| l.state == LicenseState::Approved && l.expires_at.is_some_and(|at| at <= now))
            .cloned()
            .collect();
        due.sort_by_key(|l| (l.expires_at, l.track_id));
        due.truncate(limit as usize);
        Ok(due)
    }
}
