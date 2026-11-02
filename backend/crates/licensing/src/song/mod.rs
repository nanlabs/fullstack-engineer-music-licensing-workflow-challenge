//! Songs: the tenant's catalogue of licensable music.
//!
//! A song is not owned by a movie: tracks reference it from any scene of any
//! movie of the tenant, so the collection is flat (`/songs`). It carries the
//! industry identifiers of the recording (ISRC) and of the underlying work
//! (ISWC), both stored normalized, and the rights holder ACME negotiates
//! with. The rights holder is a counterparty described by plain columns,
//! never a user of the system. The license state belongs to the track, not
//! to the song. `docs/licensing.md` records the research behind the shape.

pub mod identifiers;
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
use kernel::{SongId, TenantId};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Who controls the rights ACME negotiates for. Informational: it tells the
/// licensing team whom they are talking to, nothing more.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RightsHolderKind {
    Artist,
    Label,
    Publisher,
}

impl RightsHolderKind {
    /// Database representation (matches the `CHECK` constraint in `0007_songs.sql`).
    pub fn as_str(self) -> &'static str {
        match self {
            RightsHolderKind::Artist => "artist",
            RightsHolderKind::Label => "label",
            RightsHolderKind::Publisher => "publisher",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Song {
    pub id: SongId,
    pub tenant_id: TenantId,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub release_year: Option<i32>,
    pub duration_ms: Option<i32>,
    /// Recording code, normalized: 12 characters, upper case, no separators.
    pub isrc: Option<String>,
    /// Work code, normalized: `T` + 9 digits + check digit, no separators.
    pub iswc: Option<String>,
    pub rights_holder: String,
    pub rights_holder_kind: Option<RightsHolderKind>,
    pub rights_holder_email: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SongResponse {
    pub id: SongId,
    pub tenant_id: TenantId,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub release_year: Option<i32>,
    pub duration_ms: Option<i32>,
    pub isrc: Option<String>,
    pub iswc: Option<String>,
    pub rights_holder: String,
    pub rights_holder_kind: Option<RightsHolderKind>,
    pub rights_holder_email: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Song> for SongResponse {
    fn from(s: &Song) -> Self {
        Self {
            id: s.id,
            tenant_id: s.tenant_id,
            title: s.title.clone(),
            artist: s.artist.clone(),
            album: s.album.clone(),
            release_year: s.release_year,
            duration_ms: s.duration_ms,
            isrc: s.isrc.clone(),
            iswc: s.iswc.clone(),
            rights_holder: s.rights_holder.clone(),
            rights_holder_kind: s.rights_holder_kind,
            rights_holder_email: s.rights_holder_email.clone(),
            notes: s.notes.clone(),
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

/// First sound recording (1877) up to a generous horizon; mirrored by the database `CHECK`.
pub const MIN_RELEASE_YEAR: i32 = 1877;
pub const MAX_RELEASE_YEAR: i32 = 2100;

/// Lengths are checked at the boundary; ranges, identifiers and the e-mail
/// are checked in the service so creation and partial updates share one rule.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSongRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    #[validate(length(min = 1, max = 200))]
    pub artist: String,
    #[validate(length(max = 200))]
    pub album: Option<String>,
    pub release_year: Option<i32>,
    pub duration_ms: Option<i32>,
    /// Accepted with or without separators, any case.
    #[validate(length(max = 20))]
    pub isrc: Option<String>,
    #[validate(length(max = 20))]
    pub iswc: Option<String>,
    #[validate(length(min = 1, max = 200))]
    pub rights_holder: String,
    pub rights_holder_kind: Option<RightsHolderKind>,
    #[validate(length(max = 254))]
    pub rights_holder_email: Option<String>,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}

/// Partial update. Absent fields keep their value; `""` clears an optional
/// text (`album`, `isrc`, `iswc`, `rights_holder_email`, `notes`) and `null`
/// clears `release_year`, `duration_ms` or `rights_holder_kind`.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSongRequest {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    #[validate(length(min = 1, max = 200))]
    pub artist: Option<String>,
    #[validate(length(max = 200))]
    pub album: Option<String>,
    #[serde(default, deserialize_with = "kernel::json::double_option")]
    pub release_year: Option<Option<i32>>,
    #[serde(default, deserialize_with = "kernel::json::double_option")]
    pub duration_ms: Option<Option<i32>>,
    #[validate(length(max = 20))]
    pub isrc: Option<String>,
    #[validate(length(max = 20))]
    pub iswc: Option<String>,
    #[validate(length(min = 1, max = 200))]
    pub rights_holder: Option<String>,
    #[serde(default, deserialize_with = "kernel::json::double_option")]
    pub rights_holder_kind: Option<Option<RightsHolderKind>>,
    #[validate(length(max = 254))]
    pub rights_holder_email: Option<String>,
    #[validate(length(max = 2000))]
    pub notes: Option<String>,
}

/// Query-string filters for `GET /songs`.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct SongFilter {
    /// Case-insensitive substring match on the title or the artist.
    pub q: Option<String>,
}

impl SongFilter {
    /// Trimmed search term, `None` when blank.
    pub fn term(&self) -> Option<&str> {
        self.q.as_deref().map(str::trim).filter(|q| !q.is_empty())
    }
}

pub fn check_release_year(year: Option<i32>) -> Result<(), AppError> {
    match year {
        Some(y) if !(MIN_RELEASE_YEAR..=MAX_RELEASE_YEAR).contains(&y) => Err(AppError::validation(format!(
            "release_year must be between {MIN_RELEASE_YEAR} and {MAX_RELEASE_YEAR}"
        ))
        .detail("field", "release_year")),
        _ => Ok(()),
    }
}

pub fn check_duration(duration_ms: Option<i32>) -> Result<(), AppError> {
    match duration_ms {
        Some(d) if d <= 0 => Err(AppError::validation("duration_ms must be positive").detail("field", "duration_ms")),
        _ => Ok(()),
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SongError {
    #[error("Song not found")]
    NotFound,
    #[error("Another song of this tenant already has this ISRC")]
    IsrcTaken,
    #[error("The song is placed in one or more tracks; remove them first")]
    InUse,
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<SongError> for AppError {
    fn from(err: SongError) -> Self {
        match err {
            SongError::NotFound => AppError::not_found("SONG_NOT_FOUND", err.to_string()),
            SongError::IsrcTaken => AppError::conflict("SONG_ISRC_TAKEN", err.to_string()).detail("field", "isrc"),
            SongError::InUse => AppError::conflict("SONG_IN_USE", err.to_string()),
            SongError::App(inner) => inner,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn year_and_duration_rules() {
        assert!(check_release_year(None).is_ok());
        assert!(check_release_year(Some(1877)).is_ok());
        assert!(check_release_year(Some(2100)).is_ok());
        assert_eq!(
            check_release_year(Some(1876)).unwrap_err().details()["field"],
            "release_year"
        );
        assert_eq!(
            check_release_year(Some(2101)).unwrap_err().details()["field"],
            "release_year"
        );
        assert!(check_duration(None).is_ok());
        assert!(check_duration(Some(1)).is_ok());
        assert_eq!(check_duration(Some(0)).unwrap_err().details()["field"], "duration_ms");
        assert_eq!(check_duration(Some(-5)).unwrap_err().details()["field"], "duration_ms");
    }

    #[test]
    fn errors_map_to_stable_codes() {
        let err = AppError::from(SongError::IsrcTaken);
        assert_eq!(err.code(), "SONG_ISRC_TAKEN");
        assert_eq!(err.details()["field"], "isrc");
        assert_eq!(AppError::from(SongError::InUse).code(), "SONG_IN_USE");
        assert_eq!(AppError::from(SongError::NotFound).code(), "SONG_NOT_FOUND");
    }
}
