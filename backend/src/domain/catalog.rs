//! Reference data a track is defined against.
//!
//! Movies, scenes, and songs are read-only in this system: they are seeded, not
//! authored through the API, so these types carry no mutation behaviour.

use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Movie {
    pub id: Uuid,
    pub title: String,
    pub created_at: DateTime<Utc>,
}

/// A timed segment of a movie. `duration_ms` is the upper bound every track
/// interval within the scene is validated against.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Scene {
    pub id: Uuid,
    pub movie_id: Uuid,
    pub sequence_number: i32,
    pub title: String,
    pub duration_ms: i32,
}

/// A song has no licensing state of its own: licensing belongs to the track
/// that places a song in a scene.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Song {
    pub id: Uuid,
    pub title: String,
    pub artist_name: String,
}
