use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::kernel::{LabelId, SongId, UserId};

// ============================================================================
// Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: SongId,
    pub title: String,
    pub artist_id: UserId,
    pub label_id: Option<LabelId>,
    pub album: Option<String>,
    pub duration_seconds: i32,
    pub genre: Option<String>,
    pub isrc: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Song {
    pub fn new(
        title: String,
        artist_id: UserId,
        label_id: Option<LabelId>,
        duration_seconds: i32,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: SongId::new(),
            title,
            artist_id,
            label_id,
            album: None,
            duration_seconds,
            genre: None,
            isrc: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Returns the rights holder: label if present, otherwise the artist
    pub fn rights_holder_label(&self) -> Option<&LabelId> {
        self.label_id.as_ref()
    }
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSongRequest {
    pub title: String,
    pub artist_id: UserId,
    pub label_id: Option<LabelId>,
    pub album: Option<String>,
    pub duration_seconds: i32,
    pub genre: Option<String>,
    pub isrc: Option<String>,
}

impl CreateSongRequest {
    pub fn validate(&self) -> Result<(), crate::error::AppError> {
        if self.title.trim().is_empty() {
            return Err(crate::error::AppError::validation("Title is required")
                .with_detail("field", "title"));
        }
        if self.duration_seconds <= 0 {
            return Err(
                crate::error::AppError::validation("Duration must be positive")
                    .with_detail("field", "duration_seconds"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSongRequest {
    pub title: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub isrc: Option<String>,
    pub duration_seconds: Option<i32>,
}

impl UpdateSongRequest {
    pub fn validate(&self) -> Result<(), crate::error::AppError> {
        if let Some(title) = &self.title
            && title.trim().is_empty()
        {
            return Err(crate::error::AppError::validation("Title cannot be empty")
                .with_detail("field", "title"));
        }
        if let Some(dur) = self.duration_seconds
            && dur <= 0
        {
            return Err(
                crate::error::AppError::validation("Duration must be positive")
                    .with_detail("field", "duration_seconds"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SongResponse {
    pub id: SongId,
    pub title: String,
    pub artist_id: UserId,
    pub artist_name: Option<String>,
    pub label_id: Option<LabelId>,
    pub label_name: Option<String>,
    pub album: Option<String>,
    pub duration_seconds: i32,
    pub genre: Option<String>,
    pub isrc: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Song> for SongResponse {
    fn from(s: &Song) -> Self {
        Self {
            id: s.id.clone(),
            title: s.title.clone(),
            artist_id: s.artist_id.clone(),
            artist_name: None,
            label_id: s.label_id.clone(),
            label_name: None,
            album: s.album.clone(),
            duration_seconds: s.duration_seconds,
            genre: s.genre.clone(),
            isrc: s.isrc.clone(),
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

/// A [`Song`] enriched with names resolved from other aggregates (artist,
/// label). Built by the service layer via a batch lookup; kept separate from
/// `Song` so the domain model stays free of cross-aggregate concerns.
#[derive(Debug, Clone)]
pub struct SongWithDetails {
    pub song: Song,
    pub artist_name: Option<String>,
    pub label_name: Option<String>,
}

impl From<&SongWithDetails> for SongResponse {
    fn from(d: &SongWithDetails) -> Self {
        let mut res = SongResponse::from(&d.song);
        res.artist_name = d.artist_name.clone();
        res.label_name = d.label_name.clone();
        res
    }
}

/// Filter for searching songs
#[derive(Debug, Default, Deserialize)]
pub struct SongFilter {
    pub search: Option<String>,
    pub artist_id: Option<UserId>,
    pub label_id: Option<LabelId>,
    pub genre: Option<String>,
}
