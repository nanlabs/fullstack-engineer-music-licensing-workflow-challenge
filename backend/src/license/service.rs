use std::sync::Arc;

use chrono::Utc;
use tokio::sync::broadcast;

use crate::error::AppError;
use crate::iam::user::{UserRepository, UserRepositoryExt};
use crate::kernel::{LicenseRequestId, TrackId, UserId};
use crate::label::{LabelRepository, LabelRole};
use crate::movie::{MovieMember, MovieRepository, MovieRole};
use crate::scene::SceneRepository;
use crate::song::SongRepository;
use crate::track::TrackRepository;

use super::error::LicenseError;
use super::model::{
    CreateLicenseRequest, LicenseEvent, LicenseEventKind, LicenseOffer, LicenseOfferWithDetails,
    LicenseRequest, LicenseRequestWithDetails, LicenseStatus, NegotiationSide, OfferTerms,
};
use super::port::LicenseRepository;

/// License negotiation service.
///
/// The workflow is an offer/counter-offer exchange:
/// 1. The movie team drafts a request with an initial offer (private).
/// 2. On submit, the offer is sent to the rights holder (label if the song
///    has one, otherwise the artist).
/// 3. The side that *received* the latest offer can accept it, reject it,
///    or send a counter-offer — which puts the ball back in the other court.
/// 4. Nobody can accept or reject their own side's offer.
/// 5. The movie team can cancel (withdraw) an open request at any time.
pub struct LicenseService {
    license_repo: Arc<dyn LicenseRepository>,
    track_repo: Arc<dyn TrackRepository>,
    scene_repo: Arc<dyn SceneRepository>,
    movie_repo: Arc<dyn MovieRepository>,
    song_repo: Arc<dyn SongRepository>,
    label_repo: Arc<dyn LabelRepository>,
    user_repo: Arc<dyn UserRepository>,
    events_tx: broadcast::Sender<LicenseEvent>,
}

impl LicenseService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        license_repo: Arc<dyn LicenseRepository>,
        track_repo: Arc<dyn TrackRepository>,
        scene_repo: Arc<dyn SceneRepository>,
        movie_repo: Arc<dyn MovieRepository>,
        song_repo: Arc<dyn SongRepository>,
        label_repo: Arc<dyn LabelRepository>,
        user_repo: Arc<dyn UserRepository>,
        events_tx: broadcast::Sender<LicenseEvent>,
    ) -> Self {
        Self {
            license_repo,
            track_repo,
            scene_repo,
            movie_repo,
            song_repo,
            label_repo,
            user_repo,
            events_tx,
        }
    }

    /// Subscribe to license events (used by the SSE endpoint).
    pub fn subscribe(&self) -> broadcast::Receiver<LicenseEvent> {
        self.events_tx.subscribe()
    }

    async fn emit(&self, license: &LicenseRequest, kind: LicenseEventKind, actor: &UserId) {
        let actor_name = self
            .user_repo
            .get_by_id(actor)
            .await
            .ok()
            .flatten()
            .map(|u| u.name)
            .unwrap_or_else(|| "Unknown".to_string());
        let event = LicenseEvent {
            license_id: license.id.clone(),
            track_id: license.track_id.clone(),
            kind,
            actor: actor.clone(),
            actor_name,
            timestamp: Utc::now(),
        };
        // Ignore send error — it just means no subscribers are listening.
        let _ = self.events_tx.send(event);
    }

    // ========================================================================
    // Authorization
    // ========================================================================

    /// Is the actor a movie member (Owner/Supervisor/Editor) of the movie
    /// this track belongs to? Resolves track → scene → movie.
    async fn is_movie_team(&self, track_id: &TrackId, actor: &UserId) -> Result<bool, AppError> {
        let track = self
            .track_repo
            .get_by_id(track_id)
            .await?
            .ok_or_else(|| AppError::not_found("Track not found"))?;

        let scene = self
            .scene_repo
            .get_by_id(&track.scene_id)
            .await?
            .ok_or_else(|| AppError::not_found("Scene not found"))?;

        let member = self.movie_repo.get_member(&scene.movie_id, actor).await?;
        Ok(matches!(member, Some(MovieMember { role, .. }) if role != MovieRole::Viewer))
    }

    /// Is the actor the rights holder for this track's song?
    /// If the song has a label, only label members (Owner/Rep) hold the rights.
    /// If the song has no label, the artist holds the rights.
    async fn is_rights_holder(&self, track_id: &TrackId, actor: &UserId) -> Result<bool, AppError> {
        let track = self
            .track_repo
            .get_by_id(track_id)
            .await?
            .ok_or_else(|| AppError::not_found("Track not found"))?;

        let song = self
            .song_repo
            .get_by_id(&track.song_id)
            .await?
            .ok_or_else(|| AppError::not_found("Song not found"))?;

        match &song.label_id {
            Some(label_id) => {
                let member = self.label_repo.get_member(label_id, actor).await?;
                Ok(matches!(
                    member,
                    Some(m) if m.role == LabelRole::Owner || m.role == LabelRole::Rep
                ))
            }
            None => Ok(song.artist_id == *actor),
        }
    }

    /// Which side of the negotiation is the actor on? Errors if neither.
    async fn resolve_side(
        &self,
        track_id: &TrackId,
        actor: &UserId,
    ) -> Result<NegotiationSide, AppError> {
        if self.is_movie_team(track_id, actor).await? {
            return Ok(NegotiationSide::MovieTeam);
        }
        if self.is_rights_holder(track_id, actor).await? {
            return Ok(NegotiationSide::RightsHolder);
        }
        Err(LicenseError::not_authorized(actor))
    }

    async fn assert_movie_team(&self, track_id: &TrackId, actor: &UserId) -> Result<(), AppError> {
        if self.is_movie_team(track_id, actor).await? {
            Ok(())
        } else {
            Err(LicenseError::not_authorized(actor))
        }
    }

    /// The actor may only act on (accept/reject/counter) the latest offer if
    /// they are on the opposite side of whoever made it.
    async fn assert_can_respond(
        &self,
        license: &LicenseRequest,
        actor: &UserId,
    ) -> Result<(NegotiationSide, LicenseOffer), AppError> {
        let side = self.resolve_side(&license.track_id, actor).await?;
        let latest = self
            .license_repo
            .get_latest_offer(&license.id)
            .await?
            .ok_or_else(LicenseError::no_offer)?;
        if latest.side == side {
            return Err(LicenseError::own_offer(actor));
        }
        Ok((side, latest))
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    fn apply_terms(offer: &mut LicenseOffer, terms: &OfferTerms) {
        offer.license_fee = terms.license_fee;
        offer.currency = terms.currency.clone();
        offer.territory = terms.territory.clone();
        offer.media_rights = terms.media_rights.clone();
        offer.license_start = terms.license_start;
        offer.license_end = terms.license_end;
        offer.exclusive = terms.exclusive.unwrap_or(false);
        offer.notes = terms.notes.clone();
    }

    async fn next_offer(
        &self,
        license_id: &LicenseRequestId,
        side: NegotiationSide,
        proposed_by: UserId,
        terms: &OfferTerms,
    ) -> Result<LicenseOffer, AppError> {
        let latest = self.license_repo.get_latest_offer(license_id).await?;
        let number = latest.map(|o| o.offer_number + 1).unwrap_or(1);
        let mut offer = LicenseOffer::new(license_id.clone(), number, side, proposed_by);
        Self::apply_terms(&mut offer, terms);
        self.license_repo.save_offer(&offer).await?;
        Ok(offer)
    }

    // ========================================================================
    // Queries
    // ========================================================================

    pub async fn get_license(&self, id: &LicenseRequestId) -> Result<LicenseRequest, AppError> {
        self.license_repo
            .get_by_id(id)
            .await?
            .ok_or_else(LicenseError::not_found)
    }

    pub async fn get_by_track(
        &self,
        track_id: &TrackId,
    ) -> Result<Option<LicenseRequest>, AppError> {
        self.license_repo.get_by_track(track_id).await
    }

    /// Most recent license request for a track, regardless of status
    /// (including rejected/cancelled). Used for display purposes.
    pub async fn latest_by_track(
        &self,
        track_id: &TrackId,
    ) -> Result<Option<LicenseRequest>, AppError> {
        Ok(self
            .license_repo
            .list_by_track(track_id)
            .await?
            .into_iter()
            .next())
    }

    /// Full negotiation history, oldest offer first.
    pub async fn list_offers(
        &self,
        license_id: &LicenseRequestId,
    ) -> Result<Vec<LicenseOffer>, AppError> {
        self.get_license(license_id).await?;
        self.license_repo.list_offers(license_id).await
    }

    // ========================================================================
    // Commands
    // ========================================================================

    /// Movie team drafts a license request with the initial offer.
    pub async fn create_license(
        &self,
        req: CreateLicenseRequest,
        created_by: UserId,
    ) -> Result<(LicenseRequest, LicenseOffer), AppError> {
        self.track_repo
            .get_by_id(&req.track_id)
            .await?
            .ok_or_else(|| AppError::not_found("Track not found"))?;

        self.assert_movie_team(&req.track_id, &created_by).await?;

        if self
            .license_repo
            .get_by_track(&req.track_id)
            .await?
            .is_some()
        {
            return Err(LicenseError::already_exists());
        }

        let license = LicenseRequest::new(req.track_id.clone(), created_by.clone());

        // Persisted atomically: a request must never exist without its
        // initial offer.
        let mut offer = LicenseOffer::new(
            license.id.clone(),
            1,
            NegotiationSide::MovieTeam,
            created_by,
        );
        Self::apply_terms(&mut offer, &req.terms);
        self.license_repo.save_with_offer(&license, &offer).await?;

        Ok((license, offer))
    }

    /// Movie team revises the offer while still in Draft.
    pub async fn revise_draft(
        &self,
        id: &LicenseRequestId,
        terms: OfferTerms,
        actor: UserId,
    ) -> Result<LicenseOffer, AppError> {
        let license = self.get_license(id).await?;
        self.assert_movie_team(&license.track_id, &actor).await?;
        if license.status != LicenseStatus::Draft {
            return Err(LicenseError::invalid_transition(
                license.status.as_str(),
                "revise draft",
            ));
        }
        self.next_offer(&license.id, NegotiationSide::MovieTeam, actor, &terms)
            .await
    }

    /// Movie team sends the request to the rights holder. Draft → Requested.
    pub async fn submit(
        &self,
        id: &LicenseRequestId,
        actor: UserId,
    ) -> Result<LicenseRequest, AppError> {
        let mut license = self.get_license(id).await?;
        self.assert_movie_team(&license.track_id, &actor).await?;
        Self::assert_transition(&license.status, &LicenseStatus::Requested)?;
        license.status = LicenseStatus::Requested;
        license.updated_at = Utc::now();
        self.license_repo.update(&license).await?;
        self.emit(&license, LicenseEventKind::Submitted, &actor)
            .await;
        Ok(license)
    }

    /// Counter the latest offer. Only the side that received it can counter.
    pub async fn counter_offer(
        &self,
        id: &LicenseRequestId,
        terms: OfferTerms,
        actor: UserId,
    ) -> Result<LicenseOffer, AppError> {
        let license = self.get_license(id).await?;
        if license.status != LicenseStatus::Requested {
            return Err(LicenseError::invalid_transition(
                license.status.as_str(),
                "counter offer",
            ));
        }
        let (side, _) = self.assert_can_respond(&license, &actor).await?;
        let offer = self
            .next_offer(&license.id, side, actor.clone(), &terms)
            .await?;
        self.emit(&license, LicenseEventKind::CounterOffer, &actor)
            .await;
        Ok(offer)
    }

    /// Accept the latest offer. Only the side that received it can accept —
    /// you can never approve your own offer. Requested → Approved.
    pub async fn accept(
        &self,
        id: &LicenseRequestId,
        actor: UserId,
    ) -> Result<LicenseRequest, AppError> {
        let mut license = self.get_license(id).await?;
        Self::assert_transition(&license.status, &LicenseStatus::Approved)?;
        self.assert_can_respond(&license, &actor).await?;
        license.status = LicenseStatus::Approved;
        license.resolved_by = Some(actor.clone());
        license.resolved_at = Some(Utc::now());
        license.updated_at = Utc::now();
        self.license_repo.update(&license).await?;
        self.emit(&license, LicenseEventKind::Accepted, &actor)
            .await;
        Ok(license)
    }

    /// Reject the latest offer. Only the side that received it can reject.
    /// Requested → Rejected.
    pub async fn reject(
        &self,
        id: &LicenseRequestId,
        actor: UserId,
        reason: String,
    ) -> Result<LicenseRequest, AppError> {
        let mut license = self.get_license(id).await?;
        Self::assert_transition(&license.status, &LicenseStatus::Rejected)?;
        self.assert_can_respond(&license, &actor).await?;
        license.status = LicenseStatus::Rejected;
        license.resolved_by = Some(actor.clone());
        license.resolved_at = Some(Utc::now());
        license.rejection_reason = Some(reason);
        license.updated_at = Utc::now();
        self.license_repo.update(&license).await?;
        self.emit(&license, LicenseEventKind::Rejected, &actor)
            .await;
        Ok(license)
    }

    /// Movie team withdraws an open request. Requested → Cancelled.
    pub async fn cancel(
        &self,
        id: &LicenseRequestId,
        actor: UserId,
    ) -> Result<LicenseRequest, AppError> {
        let mut license = self.get_license(id).await?;
        self.assert_movie_team(&license.track_id, &actor).await?;
        Self::assert_transition(&license.status, &LicenseStatus::Cancelled)?;
        license.status = LicenseStatus::Cancelled;
        license.resolved_by = Some(actor.clone());
        license.resolved_at = Some(Utc::now());
        license.updated_at = Utc::now();
        self.license_repo.update(&license).await?;
        self.emit(&license, LicenseEventKind::Cancelled, &actor)
            .await;
        Ok(license)
    }

    /// Delete a request that never left Draft.
    pub async fn delete_license(
        &self,
        id: &LicenseRequestId,
        actor: UserId,
    ) -> Result<(), AppError> {
        let license = self.get_license(id).await?;
        self.assert_movie_team(&license.track_id, &actor).await?;
        if license.status != LicenseStatus::Draft {
            return Err(LicenseError::invalid_transition(
                license.status.as_str(),
                "delete",
            ));
        }
        self.license_repo.delete(id).await
    }

    // ========================================================================
    // State machine
    // ========================================================================

    /// Valid transitions:
    /// Draft → Requested
    /// Requested → Approved | Rejected | Cancelled
    fn assert_transition(from: &LicenseStatus, to: &LicenseStatus) -> Result<(), AppError> {
        let valid = matches!(
            (from, to),
            (LicenseStatus::Draft, LicenseStatus::Requested)
                | (LicenseStatus::Requested, LicenseStatus::Approved)
                | (LicenseStatus::Requested, LicenseStatus::Rejected)
                | (LicenseStatus::Requested, LicenseStatus::Cancelled)
        );
        if !valid {
            return Err(LicenseError::invalid_transition(from.as_str(), to.as_str()));
        }
        Ok(())
    }

    // ========================================================================
    // Response enrichment
    // ========================================================================

    pub async fn to_detail(
        &self,
        license: LicenseRequest,
    ) -> Result<LicenseRequestWithDetails, AppError> {
        let mut ids: Vec<UserId> = vec![license.requested_by.clone()];
        if let Some(resolved_by) = &license.resolved_by {
            ids.push(resolved_by.clone());
        }
        let names = self.user_repo.resolve_names(ids).await?;

        let requested_by_name = names.get(&license.requested_by).cloned();
        let resolved_by_name = license
            .resolved_by
            .as_ref()
            .and_then(|id| names.get(id).cloned());

        Ok(LicenseRequestWithDetails {
            license,
            requested_by_name,
            resolved_by_name,
        })
    }

    pub async fn to_offer_details(
        &self,
        offers: Vec<LicenseOffer>,
    ) -> Result<Vec<LicenseOfferWithDetails>, AppError> {
        let names = self
            .user_repo
            .resolve_names(offers.iter().map(|o| o.proposed_by.clone()))
            .await?;
        Ok(offers
            .into_iter()
            .map(|o| {
                let proposed_by_name = names.get(&o.proposed_by).cloned();
                LicenseOfferWithDetails {
                    offer: o,
                    proposed_by_name,
                }
            })
            .collect())
    }

    pub async fn to_offer_detail(
        &self,
        offer: LicenseOffer,
    ) -> Result<LicenseOfferWithDetails, AppError> {
        Ok(self.to_offer_details(vec![offer]).await?.remove(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iam::user::{User, UserFilter};
    use crate::kernel::{LabelId, MovieId, Paginated, PaginationOptions, SceneId, SongId};
    use crate::label::{Label, LabelMember, LabelRole};
    use crate::movie::{Movie, MovieFilter, MovieMember, MovieRole};
    use crate::scene::Scene;
    use crate::song::{Song, SongFilter};
    use crate::track::{Track, UsageType};
    use chrono::Utc;
    use tokio::sync::Mutex;

    // ========================================================================
    // Mocks
    // ========================================================================

    struct MockLicenseRepo {
        licenses: Mutex<Vec<LicenseRequest>>,
        offers: Mutex<Vec<LicenseOffer>>,
    }
    impl MockLicenseRepo {
        fn new() -> Self {
            Self {
                licenses: Mutex::new(Vec::new()),
                offers: Mutex::new(Vec::new()),
            }
        }
    }
    #[async_trait::async_trait]
    impl LicenseRepository for MockLicenseRepo {
        async fn save(&self, license: &LicenseRequest) -> Result<(), AppError> {
            self.licenses.lock().await.push(license.clone());
            Ok(())
        }
        async fn save_with_offer(
            &self,
            license: &LicenseRequest,
            offer: &LicenseOffer,
        ) -> Result<(), AppError> {
            self.licenses.lock().await.push(license.clone());
            self.offers.lock().await.push(offer.clone());
            Ok(())
        }
        async fn get_by_id(
            &self,
            id: &LicenseRequestId,
        ) -> Result<Option<LicenseRequest>, AppError> {
            Ok(self
                .licenses
                .lock()
                .await
                .iter()
                .find(|l| l.id == *id)
                .cloned())
        }
        async fn get_by_track(
            &self,
            track_id: &TrackId,
        ) -> Result<Option<LicenseRequest>, AppError> {
            Ok(self
                .licenses
                .lock()
                .await
                .iter()
                .find(|l| {
                    l.track_id == *track_id
                        && l.status != LicenseStatus::Rejected
                        && l.status != LicenseStatus::Cancelled
                })
                .cloned())
        }
        async fn list_by_track(&self, track_id: &TrackId) -> Result<Vec<LicenseRequest>, AppError> {
            Ok(self
                .licenses
                .lock()
                .await
                .iter()
                .filter(|l| l.track_id == *track_id)
                .cloned()
                .collect())
        }
        async fn update(&self, license: &LicenseRequest) -> Result<(), AppError> {
            let mut licenses = self.licenses.lock().await;
            if let Some(l) = licenses.iter_mut().find(|l| l.id == license.id) {
                *l = license.clone();
            }
            Ok(())
        }
        async fn delete(&self, id: &LicenseRequestId) -> Result<(), AppError> {
            self.licenses.lock().await.retain(|l| l.id != *id);
            Ok(())
        }
        async fn save_offer(&self, offer: &LicenseOffer) -> Result<(), AppError> {
            self.offers.lock().await.push(offer.clone());
            Ok(())
        }
        async fn list_offers(
            &self,
            license_id: &LicenseRequestId,
        ) -> Result<Vec<LicenseOffer>, AppError> {
            let mut offers: Vec<LicenseOffer> = self
                .offers
                .lock()
                .await
                .iter()
                .filter(|o| o.license_request_id == *license_id)
                .cloned()
                .collect();
            offers.sort_by_key(|o| o.offer_number);
            Ok(offers)
        }
        async fn get_latest_offer(
            &self,
            license_id: &LicenseRequestId,
        ) -> Result<Option<LicenseOffer>, AppError> {
            Ok(self.list_offers(license_id).await?.into_iter().last())
        }
    }

    struct MockTrackRepo {
        tracks: Mutex<Vec<Track>>,
    }
    #[async_trait::async_trait]
    impl TrackRepository for MockTrackRepo {
        async fn save(&self, _: &Track) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &TrackId) -> Result<Option<Track>, AppError> {
            Ok(self
                .tracks
                .lock()
                .await
                .iter()
                .find(|t| t.id == *id)
                .cloned())
        }
        async fn list_by_scene(&self, _: &SceneId) -> Result<Vec<Track>, AppError> {
            Ok(vec![])
        }
        async fn list_by_song(&self, _: &SongId) -> Result<Vec<Track>, AppError> {
            Ok(vec![])
        }
        async fn get_by_scene_and_song(
            &self,
            _: &SceneId,
            _: &SongId,
        ) -> Result<Option<Track>, AppError> {
            Ok(None)
        }
        async fn update(&self, _: &Track) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &TrackId) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockSceneRepo {
        scenes: Mutex<Vec<Scene>>,
    }
    #[async_trait::async_trait]
    impl SceneRepository for MockSceneRepo {
        async fn save(&self, _: &Scene) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &SceneId) -> Result<Option<Scene>, AppError> {
            Ok(self
                .scenes
                .lock()
                .await
                .iter()
                .find(|s| s.id == *id)
                .cloned())
        }
        async fn list_by_movie(&self, _: &MovieId) -> Result<Vec<Scene>, AppError> {
            Ok(vec![])
        }
        async fn update(&self, _: &Scene) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &SceneId) -> Result<(), AppError> {
            Ok(())
        }
    }

    struct MockMovieRepo {
        members: Mutex<Vec<MovieMember>>,
    }
    #[async_trait::async_trait]
    impl MovieRepository for MockMovieRepo {
        async fn save(&self, _: &Movie) -> Result<(), AppError> {
            Ok(())
        }
        async fn save_with_owner(&self, _: &Movie, _: &MovieMember) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, _: &MovieId) -> Result<Option<Movie>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &MovieFilter,
        ) -> Result<Paginated<Movie>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn update(&self, _: &Movie) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &MovieId) -> Result<(), AppError> {
            Ok(())
        }
        async fn list_by_user(&self, _: &UserId) -> Result<Vec<Movie>, AppError> {
            Ok(vec![])
        }
        async fn add_member(&self, member: &MovieMember) -> Result<(), AppError> {
            self.members.lock().await.push(member.clone());
            Ok(())
        }
        async fn remove_member(&self, _: &MovieId, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_member(
            &self,
            movie_id: &MovieId,
            user_id: &UserId,
        ) -> Result<Option<MovieMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .find(|m| m.movie_id == *movie_id && m.user_id == *user_id)
                .cloned())
        }
        async fn list_members(&self, _: &MovieId) -> Result<Vec<MovieMember>, AppError> {
            Ok(vec![])
        }
        async fn get_user_movies(&self, _: &UserId) -> Result<Vec<Movie>, AppError> {
            Ok(vec![])
        }
    }

    struct MockSongRepo {
        songs: Mutex<Vec<Song>>,
    }
    #[async_trait::async_trait]
    impl SongRepository for MockSongRepo {
        async fn save(&self, _: &Song) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, id: &SongId) -> Result<Option<Song>, AppError> {
            Ok(self
                .songs
                .lock()
                .await
                .iter()
                .find(|s| s.id == *id)
                .cloned())
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &SongFilter,
        ) -> Result<Paginated<Song>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn update(&self, _: &Song) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &SongId) -> Result<(), AppError> {
            Ok(())
        }
        async fn list_by_artist(&self, _: &UserId) -> Result<Vec<Song>, AppError> {
            Ok(vec![])
        }
        async fn list_by_label(&self, _: &LabelId) -> Result<Vec<Song>, AppError> {
            Ok(vec![])
        }
    }

    struct MockLabelRepo {
        members: Mutex<Vec<LabelMember>>,
    }
    #[async_trait::async_trait]
    impl LabelRepository for MockLabelRepo {
        async fn save(&self, _: &Label) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_by_id(&self, _: &LabelId) -> Result<Option<Label>, AppError> {
            Ok(None)
        }
        async fn get_by_ids(&self, _: &[LabelId]) -> Result<Vec<Label>, AppError> {
            Ok(vec![])
        }
        async fn get_by_name(&self, _: &str) -> Result<Option<Label>, AppError> {
            Ok(None)
        }
        async fn list_all(&self) -> Result<Vec<Label>, AppError> {
            Ok(vec![])
        }
        async fn update(&self, _: &Label) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &LabelId) -> Result<(), AppError> {
            Ok(())
        }
        async fn add_member(&self, member: &LabelMember) -> Result<(), AppError> {
            self.members.lock().await.push(member.clone());
            Ok(())
        }
        async fn remove_member(&self, _: &LabelId, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_member(
            &self,
            label_id: &LabelId,
            user_id: &UserId,
        ) -> Result<Option<LabelMember>, AppError> {
            Ok(self
                .members
                .lock()
                .await
                .iter()
                .find(|m| m.label_id == *label_id && m.user_id == *user_id)
                .cloned())
        }
        async fn list_members(&self, _: &LabelId) -> Result<Vec<LabelMember>, AppError> {
            Ok(vec![])
        }
        async fn get_user_labels(&self, _: &UserId) -> Result<Vec<Label>, AppError> {
            Ok(vec![])
        }
    }

    struct MockUserRepo;
    #[async_trait::async_trait]
    impl UserRepository for MockUserRepo {
        async fn get_by_id(&self, _: &UserId) -> Result<Option<User>, AppError> {
            Ok(None)
        }
        async fn get_by_ids(&self, _: &[UserId]) -> Result<Vec<User>, AppError> {
            Ok(vec![])
        }
        async fn get_by_email(&self, _: &str) -> Result<Option<User>, AppError> {
            Ok(None)
        }
        async fn find(
            &self,
            _: &PaginationOptions,
            _: &UserFilter,
        ) -> Result<Paginated<User>, AppError> {
            Ok(Paginated::new(vec![], 1, 10, 0))
        }
        async fn save(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn update(&self, _: &User) -> Result<(), AppError> {
            Ok(())
        }
        async fn delete(&self, _: &UserId) -> Result<(), AppError> {
            Ok(())
        }
    }

    // ========================================================================
    // Fixture
    // ========================================================================

    /// Movie owner on one side, song artist (or label member) on the other.
    struct Fixture {
        svc: LicenseService,
        track_id: TrackId,
        movie_owner: UserId,
        artist: UserId,
    }

    impl Fixture {
        /// Song without label: the artist is the rights holder.
        fn new() -> Self {
            Self::build(None, vec![])
        }

        /// Song with label: label members are the rights holders.
        /// Returns the fixture plus the label Owner user.
        fn with_label() -> (Self, UserId, UserId) {
            let label_id = LabelId::new();
            let label_owner = UserId::new();
            let label_artist = UserId::new();
            let members = vec![
                LabelMember {
                    label_id: label_id.clone(),
                    user_id: label_owner.clone(),
                    role: LabelRole::Owner,
                    joined_at: Utc::now(),
                },
                LabelMember {
                    label_id: label_id.clone(),
                    user_id: label_artist.clone(),
                    role: LabelRole::Artist,
                    joined_at: Utc::now(),
                },
            ];
            let f = Self::build(Some(label_id), members);
            (f, label_owner, label_artist)
        }

        fn build(label_id: Option<LabelId>, label_members: Vec<LabelMember>) -> Self {
            let movie_owner = UserId::new();
            let artist = UserId::new();

            let movie_id = MovieId::new();
            let scene = Scene::new(movie_id.clone(), "Opening".into(), 1, 0, 120);
            let song = Song::new("Song".into(), artist.clone(), label_id, 240);
            let track = Track::new(
                scene.id.clone(),
                song.id.clone(),
                UsageType::Background,
                0,
                60,
                movie_owner.clone(),
            );
            let track_id = track.id.clone();

            let movie_member = MovieMember {
                movie_id,
                user_id: movie_owner.clone(),
                role: MovieRole::Owner,
                joined_at: Utc::now(),
            };

            let svc = LicenseService::new(
                Arc::new(MockLicenseRepo::new()),
                Arc::new(MockTrackRepo {
                    tracks: Mutex::new(vec![track]),
                }),
                Arc::new(MockSceneRepo {
                    scenes: Mutex::new(vec![scene]),
                }),
                Arc::new(MockMovieRepo {
                    members: Mutex::new(vec![movie_member]),
                }),
                Arc::new(MockSongRepo {
                    songs: Mutex::new(vec![song]),
                }),
                Arc::new(MockLabelRepo {
                    members: Mutex::new(label_members),
                }),
                Arc::new(MockUserRepo),
                broadcast::channel(16).0,
            );

            Self {
                svc,
                track_id,
                movie_owner,
                artist,
            }
        }

        fn terms(fee: f64) -> OfferTerms {
            OfferTerms {
                license_fee: Some(fee),
                currency: Some("USD".into()),
                territory: Some("Worldwide".into()),
                media_rights: Some("All media".into()),
                license_start: None,
                license_end: None,
                exclusive: Some(false),
                notes: None,
            }
        }

        fn create_req(&self, fee: f64) -> CreateLicenseRequest {
            CreateLicenseRequest {
                track_id: self.track_id.clone(),
                terms: Self::terms(fee),
            }
        }

        /// Create + submit: the movie team's offer is on the table.
        async fn requested(&self, fee: f64) -> LicenseRequest {
            let (license, _) = self
                .svc
                .create_license(self.create_req(fee), self.movie_owner.clone())
                .await
                .unwrap();
            self.svc
                .submit(&license.id, self.movie_owner.clone())
                .await
                .unwrap()
        }
    }

    // ========================================================================
    // create_license
    // ========================================================================

    #[tokio::test]
    async fn create_license_success() {
        let f = Fixture::new();
        let (license, offer) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        assert_eq!(license.status, LicenseStatus::Draft);
        assert_eq!(license.requested_by, f.movie_owner);
        assert_eq!(offer.offer_number, 1);
        assert_eq!(offer.side, NegotiationSide::MovieTeam);
        assert_eq!(offer.proposed_by, f.movie_owner);
        assert_eq!(offer.license_fee, Some(1000.0));
    }

    #[tokio::test]
    async fn create_license_track_not_found() {
        let f = Fixture::new();
        let req = CreateLicenseRequest {
            track_id: TrackId::new(),
            terms: Fixture::terms(100.0),
        };
        let err = f
            .svc
            .create_license(req, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "NOT_FOUND");
    }

    #[tokio::test]
    async fn create_license_artist_not_authorized() {
        let f = Fixture::new();
        let err = f
            .svc
            .create_license(f.create_req(100.0), f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    #[tokio::test]
    async fn create_license_duplicate() {
        let f = Fixture::new();
        f.svc
            .create_license(f.create_req(100.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .create_license(f.create_req(200.0), f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.already_exists");
    }

    // ========================================================================
    // revise_draft
    // ========================================================================

    #[tokio::test]
    async fn revise_draft_success() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let offer = f
            .svc
            .revise_draft(&license.id, Fixture::terms(1500.0), f.movie_owner.clone())
            .await
            .unwrap();
        assert_eq!(offer.offer_number, 2);
        assert_eq!(offer.side, NegotiationSide::MovieTeam);
        assert_eq!(offer.license_fee, Some(1500.0));
    }

    #[tokio::test]
    async fn revise_draft_artist_denied() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .revise_draft(&license.id, Fixture::terms(1.0), f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    #[tokio::test]
    async fn revise_draft_after_submit_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .revise_draft(&license.id, Fixture::terms(1.0), f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    // ========================================================================
    // submit
    // ========================================================================

    #[tokio::test]
    async fn submit_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        assert_eq!(license.status, LicenseStatus::Requested);
    }

    #[tokio::test]
    async fn submit_artist_denied() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .submit(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    #[tokio::test]
    async fn submit_twice_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .submit(&license.id, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    // ========================================================================
    // counter_offer
    // ========================================================================

    #[tokio::test]
    async fn counter_offer_by_artist_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let offer = f
            .svc
            .counter_offer(&license.id, Fixture::terms(5000.0), f.artist.clone())
            .await
            .unwrap();
        assert_eq!(offer.offer_number, 2);
        assert_eq!(offer.side, NegotiationSide::RightsHolder);
        assert_eq!(offer.proposed_by, f.artist);
    }

    #[tokio::test]
    async fn counter_offer_back_and_forth() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc
            .counter_offer(&license.id, Fixture::terms(5000.0), f.artist.clone())
            .await
            .unwrap();
        let offer = f
            .svc
            .counter_offer(&license.id, Fixture::terms(3000.0), f.movie_owner.clone())
            .await
            .unwrap();
        assert_eq!(offer.offer_number, 3);
        assert_eq!(offer.side, NegotiationSide::MovieTeam);
    }

    #[tokio::test]
    async fn counter_offer_own_side_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        // The movie team made the latest offer — it cannot counter itself.
        let err = f
            .svc
            .counter_offer(&license.id, Fixture::terms(900.0), f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.own_offer");
    }

    #[tokio::test]
    async fn counter_offer_in_draft_fails() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .counter_offer(&license.id, Fixture::terms(1.0), f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    #[tokio::test]
    async fn counter_offer_outsider_denied() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .counter_offer(&license.id, Fixture::terms(1.0), UserId::new())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    // ========================================================================
    // accept
    // ========================================================================

    #[tokio::test]
    async fn accept_by_artist_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let approved = f.svc.accept(&license.id, f.artist.clone()).await.unwrap();
        assert_eq!(approved.status, LicenseStatus::Approved);
        assert_eq!(approved.resolved_by, Some(f.artist.clone()));
        assert!(approved.resolved_at.is_some());
    }

    #[tokio::test]
    async fn accept_by_movie_after_counter() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc
            .counter_offer(&license.id, Fixture::terms(5000.0), f.artist.clone())
            .await
            .unwrap();
        // The rights holder's counter is on the table — movie team can accept.
        let approved = f
            .svc
            .accept(&license.id, f.movie_owner.clone())
            .await
            .unwrap();
        assert_eq!(approved.status, LicenseStatus::Approved);
        assert_eq!(approved.resolved_by, Some(f.movie_owner.clone()));
    }

    #[tokio::test]
    async fn accept_own_offer_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        // The movie team made the latest offer — it cannot approve itself.
        let err = f
            .svc
            .accept(&license.id, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.own_offer");
    }

    #[tokio::test]
    async fn accept_own_counter_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc
            .counter_offer(&license.id, Fixture::terms(5000.0), f.artist.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .accept(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.own_offer");
    }

    #[tokio::test]
    async fn accept_in_draft_fails() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .accept(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    #[tokio::test]
    async fn accept_outsider_denied() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f.svc.accept(&license.id, UserId::new()).await.unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    // ========================================================================
    // reject
    // ========================================================================

    #[tokio::test]
    async fn reject_by_artist_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let rejected = f
            .svc
            .reject(&license.id, f.artist.clone(), "Too low".into())
            .await
            .unwrap();
        assert_eq!(rejected.status, LicenseStatus::Rejected);
        assert_eq!(rejected.resolved_by, Some(f.artist.clone()));
        assert_eq!(rejected.rejection_reason.as_deref(), Some("Too low"));
    }

    #[tokio::test]
    async fn reject_own_offer_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .reject(&license.id, f.movie_owner.clone(), "meh".into())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.own_offer");
    }

    #[tokio::test]
    async fn reject_by_movie_after_counter() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc
            .counter_offer(&license.id, Fixture::terms(99999.0), f.artist.clone())
            .await
            .unwrap();
        let rejected = f
            .svc
            .reject(&license.id, f.movie_owner.clone(), "Too expensive".into())
            .await
            .unwrap();
        assert_eq!(rejected.status, LicenseStatus::Rejected);
        assert_eq!(rejected.resolved_by, Some(f.movie_owner.clone()));
    }

    #[tokio::test]
    async fn reject_after_approved_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc.accept(&license.id, f.artist.clone()).await.unwrap();
        let err = f
            .svc
            .reject(&license.id, f.artist.clone(), "nope".into())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    // ========================================================================
    // cancel
    // ========================================================================

    #[tokio::test]
    async fn cancel_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let cancelled = f
            .svc
            .cancel(&license.id, f.movie_owner.clone())
            .await
            .unwrap();
        assert_eq!(cancelled.status, LicenseStatus::Cancelled);
        assert_eq!(cancelled.resolved_by, Some(f.movie_owner.clone()));
    }

    #[tokio::test]
    async fn cancel_by_artist_denied() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .cancel(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    #[tokio::test]
    async fn cancel_in_draft_fails() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .cancel(&license.id, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    #[tokio::test]
    async fn cancel_after_approved_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc.accept(&license.id, f.artist.clone()).await.unwrap();
        let err = f
            .svc
            .cancel(&license.id, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    // ========================================================================
    // delete
    // ========================================================================

    #[tokio::test]
    async fn delete_draft_success() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        f.svc
            .delete_license(&license.id, f.movie_owner.clone())
            .await
            .unwrap();
        let err = f.svc.get_license(&license.id).await.unwrap_err();
        assert_eq!(err.code, "license.not_found");
    }

    #[tokio::test]
    async fn delete_requested_fails() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let err = f
            .svc
            .delete_license(&license.id, f.movie_owner.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.invalid_transition");
    }

    #[tokio::test]
    async fn delete_draft_by_artist_denied() {
        let f = Fixture::new();
        let (license, _) = f
            .svc
            .create_license(f.create_req(1000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let err = f
            .svc
            .delete_license(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    // ========================================================================
    // label rights holder rules
    // ========================================================================

    #[tokio::test]
    async fn label_owner_is_rights_holder() {
        let (f, label_owner, _) = Fixture::with_label();
        let license = f.requested(1000.0).await;
        let offer = f
            .svc
            .counter_offer(&license.id, Fixture::terms(8000.0), label_owner.clone())
            .await
            .unwrap();
        assert_eq!(offer.side, NegotiationSide::RightsHolder);
        assert_eq!(offer.proposed_by, label_owner);
    }

    #[tokio::test]
    async fn label_owner_can_accept() {
        let (f, label_owner, _) = Fixture::with_label();
        let license = f.requested(1000.0).await;
        let approved = f
            .svc
            .accept(&license.id, label_owner.clone())
            .await
            .unwrap();
        assert_eq!(approved.status, LicenseStatus::Approved);
        assert_eq!(approved.resolved_by, Some(label_owner));
    }

    #[tokio::test]
    async fn song_artist_blocked_when_label_exists() {
        let (f, _, _) = Fixture::with_label();
        let license = f.requested(1000.0).await;
        // The song's artist is NOT the rights holder — the label is.
        let err = f
            .svc
            .accept(&license.id, f.artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    #[tokio::test]
    async fn label_artist_role_blocked() {
        let (f, _, label_artist) = Fixture::with_label();
        let license = f.requested(1000.0).await;
        // Label members with the Artist role cannot negotiate.
        let err = f
            .svc
            .accept(&license.id, label_artist.clone())
            .await
            .unwrap_err();
        assert_eq!(err.code, "license.not_authorized");
    }

    // ========================================================================
    // queries
    // ========================================================================

    #[tokio::test]
    async fn list_offers_history() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        f.svc
            .counter_offer(&license.id, Fixture::terms(5000.0), f.artist.clone())
            .await
            .unwrap();
        f.svc
            .counter_offer(&license.id, Fixture::terms(3000.0), f.movie_owner.clone())
            .await
            .unwrap();
        let offers = f.svc.list_offers(&license.id).await.unwrap();
        assert_eq!(offers.len(), 3);
        assert_eq!(offers[0].offer_number, 1);
        assert_eq!(offers[0].side, NegotiationSide::MovieTeam);
        assert_eq!(offers[1].side, NegotiationSide::RightsHolder);
        assert_eq!(offers[2].side, NegotiationSide::MovieTeam);
    }

    #[tokio::test]
    async fn get_by_track_success() {
        let f = Fixture::new();
        let license = f.requested(1000.0).await;
        let found = f.svc.get_by_track(&f.track_id).await.unwrap().unwrap();
        assert_eq!(found.id, license.id);
    }

    #[tokio::test]
    async fn get_by_track_none() {
        let f = Fixture::new();
        assert!(f.svc.get_by_track(&f.track_id).await.unwrap().is_none());
    }
}
