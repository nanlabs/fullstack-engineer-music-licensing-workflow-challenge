//! Immutable track events.
//!
//! Events are an append-only audit trail written in the same transaction as the
//! track change they describe. They are never updated or deleted, and the
//! current state is read from the track row rather than replayed from here.

use uuid::Uuid;

use crate::domain::actor::Actor;
use crate::domain::track::{LicensingState, SceneInterval};

/// Version stamped into every payload, so a consumer can tell which shape it is
/// reading before it tries to interpret the fields.
pub const PAYLOAD_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackEventType {
    TrackCreated,
    TrackRevised,
    LicensingStateChanged,
}

impl TrackEventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TrackCreated => "track_created",
            Self::TrackRevised => "track_revised",
            Self::LicensingStateChanged => "licensing_state_changed",
        }
    }
}

/// What a track looked like at a point in time.
///
/// Recorded on both sides of a revision so history reads without needing to
/// reconstruct anything from neighbouring rows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TrackDefinition {
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub interval: SceneInterval,
    pub licensing_state: LicensingState,
}

/// An event about to be written.
#[derive(Debug, Clone)]
pub struct NewTrackEvent {
    pub track_id: Uuid,
    pub movie_id: Uuid,
    pub track_version: i32,
    pub event_type: TrackEventType,
    pub actor: Actor,
    /// Set only when a revision moved the track between scenes; the event then
    /// belongs to both scenes' streams.
    pub previous_scene_id: Option<Uuid>,
    pub new_scene_id: Option<Uuid>,
    pub payload: serde_json::Value,
}

impl NewTrackEvent {
    /// Builds the event recorded when a track first exists.
    pub fn created(
        track_id: Uuid,
        movie_id: Uuid,
        actor: Actor,
        definition: TrackDefinition,
    ) -> Self {
        Self {
            track_id,
            movie_id,
            track_version: 1,
            event_type: TrackEventType::TrackCreated,
            actor,
            previous_scene_id: None,
            new_scene_id: None,
            payload: serde_json::json!({
                "payload_schema_version": PAYLOAD_SCHEMA_VERSION,
                "definition": definition_json(&definition),
            }),
        }
    }
}

pub fn definition_json(definition: &TrackDefinition) -> serde_json::Value {
    serde_json::json!({
        "scene_id": definition.scene_id,
        "song_id": definition.song_id,
        "scene_start_ms": definition.interval.start_ms(),
        "scene_end_ms": definition.interval.end_ms(),
        "licensing_state": definition.licensing_state.as_str(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn definition() -> TrackDefinition {
        TrackDefinition {
            scene_id: Uuid::from_u128(1),
            song_id: Uuid::from_u128(2),
            interval: SceneInterval::from_stored(1_000, 5_000),
            licensing_state: LicensingState::Pending,
        }
    }

    #[test]
    fn a_creation_event_carries_the_full_definition_at_version_one() {
        let actor = Actor::from_display_name("Ada").unwrap();
        let event = NewTrackEvent::created(
            Uuid::from_u128(3),
            Uuid::from_u128(4),
            actor.clone(),
            definition(),
        );

        assert_eq!(event.track_version, 1);
        assert_eq!(event.event_type, TrackEventType::TrackCreated);
        assert_eq!(event.actor, actor);
        assert!(event.previous_scene_id.is_none());

        // The database requires this key on every payload.
        assert_eq!(event.payload["payload_schema_version"], 1);
        assert_eq!(event.payload["definition"]["scene_start_ms"], 1_000);
        assert_eq!(event.payload["definition"]["licensing_state"], "pending");
    }

    #[test]
    fn event_types_use_their_stored_spelling() {
        assert_eq!(TrackEventType::TrackCreated.as_str(), "track_created");
        assert_eq!(TrackEventType::TrackRevised.as_str(), "track_revised");
        assert_eq!(
            TrackEventType::LicensingStateChanged.as_str(),
            "licensing_state_changed"
        );
    }
}
