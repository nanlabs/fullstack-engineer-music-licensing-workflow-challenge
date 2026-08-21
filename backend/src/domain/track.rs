//! Tracks: one timed use of one song in one scene.
//!
//! A track owns its licensing state. The song does not: the same song may be
//! licensed for one scene and rejected for another, and those are separate
//! propositions.

use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum InvalidInterval {
    #[error("scene_start_ms must not be negative")]
    NegativeStart,
    #[error("scene_start_ms must be before scene_end_ms")]
    NotOrdered,
    #[error("scene_end_ms must not exceed the scene duration")]
    BeyondSceneEnd,
}

/// The half-open span `[start, end)` of a scene that a track occupies.
///
/// Validated on construction, so an existing `SceneInterval` is always within
/// its scene. Tracks may overlap: two songs can legitimately play over the same
/// moment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SceneInterval {
    start_ms: i32,
    end_ms: i32,
}

impl SceneInterval {
    /// Builds an interval, checking it against the duration of the scene it
    /// belongs to.
    ///
    /// The upper bound cannot be a database `CHECK` because it spans two
    /// tables; it is enforced here, against a scene row read in the same
    /// transaction.
    pub fn new(
        start_ms: i32,
        end_ms: i32,
        scene_duration_ms: i32,
    ) -> Result<Self, InvalidInterval> {
        if start_ms < 0 {
            return Err(InvalidInterval::NegativeStart);
        }
        if start_ms >= end_ms {
            return Err(InvalidInterval::NotOrdered);
        }
        if end_ms > scene_duration_ms {
            return Err(InvalidInterval::BeyondSceneEnd);
        }

        Ok(Self { start_ms, end_ms })
    }

    /// Rebuilds an interval from a row that the database already validated.
    pub fn from_stored(start_ms: i32, end_ms: i32) -> Self {
        Self { start_ms, end_ms }
    }

    pub fn start_ms(self) -> i32 {
        self.start_ms
    }

    pub fn end_ms(self) -> i32 {
        self.end_ms
    }

    /// Duration is derived, never stored: storing it would let it disagree with
    /// the bounds.
    pub fn duration_ms(self) -> i32 {
        self.end_ms - self.start_ms
    }
}

/// Where a track sits in the licensing workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LicensingState {
    Pending,
    InNegotiation,
    Licensed,
    Rejected,
    Cancelled,
}

impl LicensingState {
    /// The wire and storage spelling. Kept snake_case so the JSON contract and
    /// the database `CHECK` constraint use exactly the same vocabulary.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::InNegotiation => "in_negotiation",
            Self::Licensed => "licensed",
            Self::Rejected => "rejected",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(Self::Pending),
            "in_negotiation" => Some(Self::InNegotiation),
            "licensed" => Some(Self::Licensed),
            "rejected" => Some(Self::Rejected),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }
}

/// A track as it currently stands.
///
/// This row is the authoritative current state. The event log beside it is an
/// audit trail, not a source to replay: this is not event sourcing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Track {
    pub id: Uuid,
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub interval: SceneInterval,
    pub licensing_state: LicensingState,
    /// Starts at 1 and increments only on material change.
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCENE_DURATION: i32 = 120_000;

    #[test]
    fn accepts_an_interval_inside_its_scene() {
        let interval = SceneInterval::new(1_000, 5_000, SCENE_DURATION).unwrap();

        assert_eq!(interval.start_ms(), 1_000);
        assert_eq!(interval.end_ms(), 5_000);
        assert_eq!(interval.duration_ms(), 4_000);
    }

    #[test]
    fn accepts_the_scene_boundaries_exactly() {
        // Zero is a valid start, and a track may run to the very end.
        let whole_scene = SceneInterval::new(0, SCENE_DURATION, SCENE_DURATION).unwrap();

        assert_eq!(whole_scene.duration_ms(), SCENE_DURATION);
    }

    #[test]
    fn rejects_a_negative_start() {
        assert_eq!(
            SceneInterval::new(-1, 5_000, SCENE_DURATION).unwrap_err(),
            InvalidInterval::NegativeStart
        );
    }

    #[test]
    fn rejects_an_empty_or_inverted_interval() {
        // A zero-length track is not a use of a song.
        assert_eq!(
            SceneInterval::new(5_000, 5_000, SCENE_DURATION).unwrap_err(),
            InvalidInterval::NotOrdered
        );
        assert_eq!(
            SceneInterval::new(5_000, 1_000, SCENE_DURATION).unwrap_err(),
            InvalidInterval::NotOrdered
        );
    }

    #[test]
    fn rejects_an_interval_running_past_the_scene() {
        assert_eq!(
            SceneInterval::new(0, SCENE_DURATION + 1, SCENE_DURATION).unwrap_err(),
            InvalidInterval::BeyondSceneEnd
        );
    }

    #[test]
    fn licensing_states_round_trip_through_their_wire_spelling() {
        for state in [
            LicensingState::Pending,
            LicensingState::InNegotiation,
            LicensingState::Licensed,
            LicensingState::Rejected,
            LicensingState::Cancelled,
        ] {
            assert_eq!(LicensingState::parse(state.as_str()), Some(state));
        }

        assert_eq!(LicensingState::parse("InNegotiation"), None);
        assert_eq!(LicensingState::parse("unknown"), None);
    }
}
