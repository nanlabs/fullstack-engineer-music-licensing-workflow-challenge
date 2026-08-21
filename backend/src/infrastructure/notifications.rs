//! The PostgreSQL `NOTIFY` payload that carries a track change to connected
//! clients.
//!
//! The payload is deliberately self-contained: it holds the complete current
//! representation of the track, so a subscriber can render the change without
//! reading the database. That is what keeps a burst of writes from turning into
//! a burst of queries, one per connected stream.
//!
//! `pg_notify` runs inside the same transaction as the track change, so the
//! notification is delivered only if — and only after — that transaction
//! commits. A rolled-back write notifies nobody.

use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::domain::catalog::Song;
use crate::domain::event::NewTrackEvent;
use crate::domain::track::Track;

/// The single channel every track change is published on. Scoping is done by
/// the subscribing stream rather than by channel name, because a channel per
/// movie would mean re-issuing `LISTEN` on a shared connection as clients come
/// and go.
pub const CHANNEL: &str = "track_events";

/// PostgreSQL refuses a notification payload of 8000 bytes or more.
///
/// Every field below is an identifier, an enum, an integer, or catalog text
/// bounded to 255 characters by a `CHECK` constraint, so a real payload is an
/// order of magnitude smaller. The guard exists so that a future field that
/// breaks that assumption degrades delivery instead of failing the write.
const MAX_PAYLOAD_BYTES: usize = 7_500;

/// One committed track change, ready to be delivered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackChangeNotification {
    /// The id of the audit event this change wrote. Present for correlation
    /// with `GET /tracks/{id}/history`; it is not a replay cursor, because the
    /// stream offers no replay.
    pub event_id: i64,
    pub event_type: String,
    pub movie_id: Uuid,
    /// Every scene whose stream must see this change. A revision that moved the
    /// track between scenes lists the previous scene as well as the new one, so
    /// both scenes' subscribers learn that it left and that it arrived.
    pub scene_ids: Vec<Uuid>,
    pub track: TrackSnapshot,
}

/// The track as the REST API would return it.
///
/// The field set mirrors `api::tracks::TrackWithSongDto` exactly, so a client
/// can apply a streamed track wherever it would apply a fetched one. A unit
/// test in `api::events` pins the two shapes together.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackSnapshot {
    pub id: Uuid,
    pub scene_id: Uuid,
    pub song_id: Uuid,
    pub scene_start_ms: i32,
    pub scene_end_ms: i32,
    pub duration_ms: i32,
    pub licensing_state: String,
    pub version: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub song: SongSummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongSummary {
    pub id: Uuid,
    pub title: String,
    pub artist_name: String,
}

impl TrackChangeNotification {
    /// Builds the notification for an event that is about to be committed.
    ///
    /// The affected scenes are derived from the event rather than passed in
    /// separately: the event already records the previous scene whenever a
    /// revision relocated the track, and deriving keeps the two from
    /// disagreeing.
    pub fn new(event_id: i64, event: &NewTrackEvent, track: &Track, song: &Song) -> Self {
        let mut scene_ids = vec![track.scene_id];
        if let Some(previous) = event.previous_scene_id {
            if previous != track.scene_id {
                scene_ids.push(previous);
            }
        }

        Self {
            event_id,
            event_type: event.event_type.as_str().to_string(),
            movie_id: event.movie_id,
            scene_ids,
            track: TrackSnapshot {
                id: track.id,
                scene_id: track.scene_id,
                song_id: track.song_id,
                scene_start_ms: track.interval.start_ms(),
                scene_end_ms: track.interval.end_ms(),
                duration_ms: track.interval.duration_ms(),
                licensing_state: track.licensing_state.as_str().to_string(),
                version: track.version,
                created_at: track.created_at,
                updated_at: track.updated_at,
                song: SongSummary {
                    id: song.id,
                    title: song.title.clone(),
                    artist_name: song.artist_name.clone(),
                },
            },
        }
    }

    /// Whether this change belongs in the stream of the given movie.
    pub fn concerns_movie(&self, movie_id: Uuid) -> bool {
        self.movie_id == movie_id
    }

    /// Whether this change belongs in the stream of the given scene.
    pub fn concerns_scene(&self, scene_id: Uuid) -> bool {
        self.scene_ids.contains(&scene_id)
    }
}

/// Queues a notification on the current transaction.
///
/// An oversized payload is dropped with an error log rather than failing the
/// write. Delivery is explicitly best-effort — a connected client may miss an
/// update and REST remains authoritative — whereas the track change and its
/// audit event are not, so losing the notification is the lesser failure.
pub async fn publish(
    transaction: &mut Transaction<'static, Postgres>,
    notification: &TrackChangeNotification,
) -> Result<(), sqlx::Error> {
    let payload =
        serde_json::to_string(notification).expect("a track notification is always serializable");

    if payload.len() > MAX_PAYLOAD_BYTES {
        tracing::error!(
            track_id = %notification.track.id,
            event_id = notification.event_id,
            payload_bytes = payload.len(),
            "notification payload exceeds the PostgreSQL limit; live delivery skipped"
        );
        return Ok(());
    }

    // Not a `query!` macro: `pg_notify` returns `void`, which has no Rust
    // mapping, and the statement has no result to type-check.
    sqlx::query("SELECT pg_notify($1, $2)")
        .bind(CHANNEL)
        .bind(&payload)
        .execute(&mut **transaction)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::actor::Actor;
    use crate::domain::event::TrackDefinition;
    use crate::domain::track::{LicensingState, SceneInterval};

    fn song() -> Song {
        Song {
            id: Uuid::from_u128(9),
            title: "Amber Lights".to_string(),
            artist_name: "The Quiet Hours".to_string(),
        }
    }

    fn track(scene_id: Uuid) -> Track {
        Track {
            id: Uuid::from_u128(1),
            scene_id,
            song_id: Uuid::from_u128(9),
            interval: SceneInterval::from_stored(1_000, 5_000),
            licensing_state: LicensingState::Pending,
            version: 2,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn definition(scene_id: Uuid) -> TrackDefinition {
        TrackDefinition {
            scene_id,
            song_id: Uuid::from_u128(9),
            interval: SceneInterval::from_stored(1_000, 5_000),
            licensing_state: LicensingState::Pending,
        }
    }

    #[test]
    fn a_change_within_one_scene_names_only_that_scene() {
        let scene_id = Uuid::from_u128(2);
        let event = NewTrackEvent::created(
            Uuid::from_u128(1),
            Uuid::from_u128(3),
            Actor::from_display_name("Ada").unwrap(),
            definition(scene_id),
        );

        let notification = TrackChangeNotification::new(7, &event, &track(scene_id), &song());

        assert_eq!(notification.scene_ids, [scene_id]);
        assert!(notification.concerns_movie(Uuid::from_u128(3)));
        assert!(!notification.concerns_movie(Uuid::from_u128(4)));
        assert!(notification.concerns_scene(scene_id));
    }

    #[test]
    fn a_relocation_names_both_the_previous_and_the_new_scene() {
        let previous_scene = Uuid::from_u128(2);
        let new_scene = Uuid::from_u128(5);

        let event = NewTrackEvent::revised(
            Uuid::from_u128(1),
            Uuid::from_u128(3),
            2,
            Actor::from_display_name("Ada").unwrap(),
            definition(previous_scene),
            definition(new_scene),
        );

        let notification = TrackChangeNotification::new(8, &event, &track(new_scene), &song());

        assert!(notification.concerns_scene(previous_scene));
        assert!(notification.concerns_scene(new_scene));
        assert_eq!(notification.scene_ids.len(), 2);
    }

    #[test]
    fn a_payload_round_trips_and_stays_well_under_the_notify_limit() {
        let scene_id = Uuid::from_u128(2);
        let event = NewTrackEvent::created(
            Uuid::from_u128(1),
            Uuid::from_u128(3),
            Actor::from_display_name("Ada").unwrap(),
            definition(scene_id),
        );
        let notification = TrackChangeNotification::new(7, &event, &track(scene_id), &song());

        let payload = serde_json::to_string(&notification).unwrap();
        assert!(
            payload.len() < MAX_PAYLOAD_BYTES / 4,
            "payload was {} bytes",
            payload.len()
        );

        let decoded: TrackChangeNotification = serde_json::from_str(&payload).unwrap();
        assert_eq!(decoded, notification);
    }
}
