//! Tracks: a song placed in a scene, the *cue* of the industry's cue sheets.
//!
//! Child entity of `scene` (owned: deleting the scene deletes its tracks)
//! that *references* a `song` (restricted: a placed song cannot be deleted).
//! `start_ms`/`end_ms` are milliseconds on the movie timeline and must fall
//! inside the scene's window when it has one; `usage` tells background from
//! featured use. A track is the unit that gets licensed: it is born with a
//! `pending` license (the `license` module) in the same transaction, and
//! reads return a [`TrackView`] with the movie, a song summary and the
//! license joined in, so the UI lists a scene or a whole movie, licensing
//! status included, in one call. While the license is active (`requested`,
//! `negotiating` or `approved`) the cue is frozen: what was quoted or
//! approved is this song, at this spot, used this way, so the song, timing
//! and usage cannot change and the track cannot be removed until the
//! license is rejected or expired ([`TrackError::LockedByLicense`]).
//! `docs/licensing.md` records the research behind the shape.

pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{MovieId, SceneId, SongId, TenantId, TrackId};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::license::{License, LicenseState, LicenseSummary};
use crate::movie::MovieError;
use crate::scene::SceneError;

/// How the music is used in the scene. `background` plays under the action
/// (score, source music off camera); `featured` is heard on its own terms
/// (an on-camera performance, a title sequence). The split drives the quote.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TrackUsage {
    Background,
    Featured,
}

impl TrackUsage {
    /// Database representation (matches the `CHECK` constraint in `0009_tracks.sql`).
    pub fn as_str(self) -> &'static str {
        match self {
            TrackUsage::Background => "background",
            TrackUsage::Featured => "featured",
        }
    }
}

/// What is validated and written.
#[derive(Debug, Clone)]
pub struct Track {
    pub id: TrackId,
    pub tenant_id: TenantId,
    pub scene_id: SceneId,
    pub song_id: SongId,
    /// Milliseconds on the movie timeline; `start_ms < end_ms`.
    pub start_ms: i32,
    pub end_ms: i32,
    pub usage: TrackUsage,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Track {
    /// The "actual use time" of a cue sheet.
    pub fn duration_ms(&self) -> i32 {
        self.end_ms - self.start_ms
    }
}

/// The song fields a scene or movie listing needs; the full song lives at `/songs/{id}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongSummary {
    pub id: SongId,
    pub title: String,
    pub artist: String,
    pub rights_holder: String,
}

/// What reads return: the track plus what the UI needs joined in.
#[derive(Debug, Clone)]
pub struct TrackView {
    pub track: Track,
    pub movie_id: MovieId,
    pub song: SongSummary,
    pub license: License,
}

/// Also the `track` of a published `LicenseChanged`, hence `Deserialize`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackResponse {
    pub id: TrackId,
    pub tenant_id: TenantId,
    pub movie_id: MovieId,
    pub scene_id: SceneId,
    pub song: SongSummary,
    pub start_ms: i32,
    pub end_ms: i32,
    /// `end_ms - start_ms`, derived.
    pub duration_ms: i32,
    pub usage: TrackUsage,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Current licensing status, with the events the caller may apply next.
    pub license: LicenseSummary,
}

impl From<&TrackView> for TrackResponse {
    fn from(v: &TrackView) -> Self {
        let t = &v.track;
        Self {
            id: t.id,
            tenant_id: t.tenant_id,
            movie_id: v.movie_id,
            scene_id: t.scene_id,
            song: v.song.clone(),
            start_ms: t.start_ms,
            end_ms: t.end_ms,
            duration_ms: t.duration_ms(),
            usage: t.usage,
            created_at: t.created_at,
            updated_at: t.updated_at,
            license: LicenseSummary::from(&v.license),
        }
    }
}

/// Not paginated: a scene has a few tracks, a movie tens, and the UI draws
/// all of them in order.
#[derive(Debug, Clone, Serialize)]
pub struct TrackList {
    pub items: Vec<TrackResponse>,
    pub count: usize,
}

/// Query string of the list routes: `?state=approved` keeps only the tracks
/// whose license is in that state.
#[derive(Debug, Default, Deserialize)]
pub struct TrackFilter {
    pub state: Option<LicenseState>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTrackRequest {
    pub song_id: SongId,
    #[validate(range(min = 0))]
    pub start_ms: i32,
    #[validate(range(min = 0))]
    pub end_ms: i32,
    pub usage: TrackUsage,
}

/// Partial update. Absent fields keep their value; nothing here is nullable.
/// `scene_id` is not editable: moving a track is delete and create.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTrackRequest {
    pub song_id: Option<SongId>,
    #[validate(range(min = 0))]
    pub start_ms: Option<i32>,
    #[validate(range(min = 0))]
    pub end_ms: Option<i32>,
    pub usage: Option<TrackUsage>,
}

/// Non-negative timecodes with the start strictly before the end.
pub fn check_span(start_ms: i32, end_ms: i32) -> Result<(), AppError> {
    if start_ms < 0 || end_ms < 0 {
        return Err(AppError::validation("Timecodes cannot be negative").detail("field", "start_ms"));
    }
    if start_ms >= end_ms {
        return Err(AppError::validation("start_ms must be before end_ms").detail("field", "end_ms"));
    }
    Ok(())
}

/// A track must fall inside its scene's window when the scene has one
/// (`window` is the scene's `(start_ms, end_ms)`); a scene without a window
/// accepts any span. The error names the offending field and the bounds.
pub fn check_inside_window(window: (Option<i32>, Option<i32>), start_ms: i32, end_ms: i32) -> Result<(), AppError> {
    let (Some(scene_start), Some(scene_end)) = window else {
        return Ok(());
    };
    let field = if start_ms < scene_start {
        "start_ms"
    } else if end_ms > scene_end {
        "end_ms"
    } else {
        return Ok(());
    };
    Err(AppError::validation(format!(
        "Track must fall inside the scene window ({scene_start}..{scene_end} ms)"
    ))
    .detail("field", field)
    .detail("scene_start_ms", scene_start)
    .detail("scene_end_ms", scene_end))
}

#[derive(Debug, thiserror::Error)]
pub enum TrackError {
    #[error("Track not found")]
    NotFound,
    /// The `song_id` in the body is not a song of the caller's tenant.
    #[error("Unknown song in this tenant")]
    UnknownSong,
    /// The license is active, so the cue is frozen (409). `fields` names
    /// what the request tried to change; empty for a delete.
    #[error("The track's license is {state}; reject or expire it before changing or removing the cue")]
    LockedByLicense {
        state: LicenseState,
        fields: Vec<&'static str>,
    },
    #[error(transparent)]
    Scene(#[from] SceneError),
    #[error(transparent)]
    Movie(#[from] MovieError),
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<TrackError> for AppError {
    fn from(err: TrackError) -> Self {
        let message = err.to_string();
        match err {
            TrackError::NotFound => AppError::not_found("TRACK_NOT_FOUND", message),
            TrackError::UnknownSong => AppError::validation(message).detail("field", "song_id"),
            TrackError::LockedByLicense { state, fields } => {
                let err = AppError::conflict("TRACK_LOCKED_BY_LICENSE", message).detail("state", state);
                if fields.is_empty() {
                    err
                } else {
                    err.detail("fields", fields)
                }
            }
            TrackError::Scene(inner) => inner.into(),
            TrackError::Movie(inner) => inner.into(),
            TrackError::App(inner) => inner,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn span_rules() {
        assert!(check_span(0, 1).is_ok());
        assert_eq!(check_span(-1, 5).unwrap_err().details()["field"], "start_ms");
        assert_eq!(check_span(5, 5).unwrap_err().details()["field"], "end_ms");
        assert_eq!(check_span(6, 5).unwrap_err().details()["field"], "end_ms");
    }

    #[test]
    fn window_rules() {
        assert!(check_inside_window((None, None), 0, 10_000_000).is_ok());
        assert!(check_inside_window((Some(1000), Some(2000)), 1000, 2000).is_ok());
        assert!(check_inside_window((Some(1000), Some(2000)), 1200, 1800).is_ok());
        let err = check_inside_window((Some(1000), Some(2000)), 900, 1500).unwrap_err();
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "start_ms");
        assert_eq!(err.details()["scene_start_ms"], 1000);
        assert_eq!(err.details()["scene_end_ms"], 2000);
        let err = check_inside_window((Some(1000), Some(2000)), 1500, 2001).unwrap_err();
        assert_eq!(err.details()["field"], "end_ms");
    }

    #[test]
    fn usage_serializes_snake_case() {
        assert_eq!(
            serde_json::to_string(&TrackUsage::Background).unwrap(),
            "\"background\""
        );
        let parsed: TrackUsage = serde_json::from_str("\"featured\"").unwrap();
        assert_eq!(parsed, TrackUsage::Featured);
        assert!(serde_json::from_str::<TrackUsage>("\"theme\"").is_err());
        assert_eq!(TrackUsage::Featured.as_str(), "featured");
    }

    #[test]
    fn errors_map_to_stable_codes() {
        let err = AppError::from(TrackError::NotFound);
        assert_eq!((err.code(), err.kind().http_status()), ("TRACK_NOT_FOUND", 404));
        let err = AppError::from(TrackError::UnknownSong);
        assert_eq!((err.code(), err.kind().http_status()), ("VALIDATION_ERROR", 400));
        assert_eq!(err.details()["field"], "song_id");
        let err = AppError::from(TrackError::Scene(SceneError::NotFound));
        assert_eq!(err.code(), "SCENE_NOT_FOUND");
        let err = AppError::from(TrackError::Movie(MovieError::NotFound));
        assert_eq!(err.code(), "MOVIE_NOT_FOUND");

        let err = AppError::from(TrackError::LockedByLicense {
            state: LicenseState::Approved,
            fields: vec!["song_id", "usage"],
        });
        assert_eq!((err.code(), err.kind().http_status()), ("TRACK_LOCKED_BY_LICENSE", 409));
        assert_eq!(
            err.message(),
            "The track's license is approved; reject or expire it before changing or removing the cue"
        );
        assert_eq!(err.details()["state"], "approved");
        assert_eq!(err.details()["fields"], serde_json::json!(["song_id", "usage"]));
        let err = AppError::from(TrackError::LockedByLicense {
            state: LicenseState::Negotiating,
            fields: vec![],
        });
        assert_eq!(err.details()["state"], "negotiating");
        assert!(err.details().get("fields").is_none(), "no fields on a delete");
    }
}
