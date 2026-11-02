//! License workflow: the stateful negotiation attached to a track.
//!
//! Every track owns one license. Its state moves through an explicit state
//! machine (`pending → requested → negotiating → approved | rejected`,
//! `rejected → negotiating` on reopen, `approved → expired`) whose transition
//! table is pure code ([`transition`]) and is unit-tested without a database.
//! Each applied transition is appended to `license_events` with who recorded
//! it (the ACME user), on whose behalf (`source`: ACME, the rights holder or
//! the expiry sweep) and an optional note, so the UI can show the whole
//! negotiation. The transition itself is a custom method per event
//! (`POST /tracks/{id}/license/{event}`); `state` is never written directly.
//! Every applied transition is also published as a [`LicenseChanged`] event
//! through the [`port::EventPublisher`] port, which is what the real-time
//! stream (`crate::events`) delivers. `docs/licensing.md` records the
//! research behind the shape.

pub mod config;
pub mod port;
pub mod service;
pub mod infra {
    pub mod postgres;
}
pub mod api {
    pub mod handlers;
}

use std::fmt;

use chrono::{DateTime, Utc};
use errx::AppError;
use kernel::{LicenseEventId, TenantId, TrackId, UserId};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::track::{TrackError, TrackResponse};

/// SQL list of the states [`LicenseState::is_active`] holds for, used by the
/// `NOT EXISTS` guards of the track, scene and movie adapters (kept next to
/// the enum so the two cannot drift; see the tests).
pub const ACTIVE_STATES_SQL: &str = "('requested', 'negotiating', 'approved')";

/// Where the negotiation stands. `approved`, `rejected` and `expired` are
/// resting states; only `rejected` can be reopened.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LicenseState {
    Pending,
    Requested,
    Negotiating,
    Approved,
    Rejected,
    Expired,
}

impl LicenseState {
    pub const ALL: [LicenseState; 6] = [
        LicenseState::Pending,
        LicenseState::Requested,
        LicenseState::Negotiating,
        LicenseState::Approved,
        LicenseState::Rejected,
        LicenseState::Expired,
    ];

    /// Database representation (matches the `CHECK` in `0011_licenses.sql`).
    pub fn as_str(self) -> &'static str {
        match self {
            LicenseState::Pending => "pending",
            LicenseState::Requested => "requested",
            LicenseState::Negotiating => "negotiating",
            LicenseState::Approved => "approved",
            LicenseState::Rejected => "rejected",
            LicenseState::Expired => "expired",
        }
    }

    /// A negotiation in progress or a license in force. While it holds, the
    /// cue it covers is frozen: the track's song, timing and usage cannot
    /// change and the track (or its scene or movie) cannot be removed
    /// (`TrackError::LockedByLicense`). `pending`, `rejected` and `expired`
    /// leave the track free; `reject` and `expire` are the ways out.
    pub fn is_active(self) -> bool {
        matches!(
            self,
            LicenseState::Requested | LicenseState::Negotiating | LicenseState::Approved
        )
    }
}

impl fmt::Display for LicenseState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// What can happen to a license. The URL segment of the transition route
/// and the `event` column of the history use the same snake_case names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LicenseEventKind {
    Request,
    StartNegotiation,
    Approve,
    Reject,
    Reopen,
    Expire,
}

impl LicenseEventKind {
    pub const ALL: [LicenseEventKind; 6] = [
        LicenseEventKind::Request,
        LicenseEventKind::StartNegotiation,
        LicenseEventKind::Approve,
        LicenseEventKind::Reject,
        LicenseEventKind::Reopen,
        LicenseEventKind::Expire,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            LicenseEventKind::Request => "request",
            LicenseEventKind::StartNegotiation => "start_negotiation",
            LicenseEventKind::Approve => "approve",
            LicenseEventKind::Reject => "reject",
            LicenseEventKind::Reopen => "reopen",
            LicenseEventKind::Expire => "expire",
        }
    }
}

impl fmt::Display for LicenseEventKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// On whose behalf an event was recorded. The actor is always an ACME user
/// (or nobody, for the sweep); `source` says who actually decided. `system`
/// is reserved for the expiry sweep: the service rejects it in a request
/// body (the enum stays deserializable because published events, sweep
/// ones included, travel as JSON between instances).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum EventSource {
    Acme,
    RightsHolder,
    System,
}

impl EventSource {
    pub fn as_str(self) -> &'static str {
        match self {
            EventSource::Acme => "acme",
            EventSource::RightsHolder => "rights_holder",
            EventSource::System => "system",
        }
    }
}

/// The transition table. Pure, exhaustive, and the only place that knows
/// which event is legal in which state.
pub fn transition(state: LicenseState, event: LicenseEventKind) -> Result<LicenseState, LicenseError> {
    use LicenseEventKind as E;
    use LicenseState as S;
    let next = match (state, event) {
        (S::Pending, E::Request) => S::Requested,
        (S::Requested, E::StartNegotiation) => S::Negotiating,
        (S::Requested, E::Reject) | (S::Negotiating, E::Reject) => S::Rejected,
        (S::Negotiating, E::Approve) => S::Approved,
        (S::Rejected, E::Reopen) => S::Negotiating,
        (S::Approved, E::Expire) => S::Expired,
        _ => return Err(LicenseError::InvalidTransition { state, event }),
    };
    Ok(next)
}

/// The events legal in `state`, in the order the UI should offer them.
/// Derived from the same table as [`transition`] (see the tests).
pub fn allowed_events(state: LicenseState) -> &'static [LicenseEventKind] {
    use LicenseEventKind as E;
    match state {
        LicenseState::Pending => &[E::Request],
        LicenseState::Requested => &[E::StartNegotiation, E::Reject],
        LicenseState::Negotiating => &[E::Approve, E::Reject],
        LicenseState::Rejected => &[E::Reopen],
        LicenseState::Approved => &[E::Expire],
        LicenseState::Expired => &[],
    }
}

/// Who usually decides each step: ACME sends and reopens requests, the
/// rights holder answers, approves or declines. A manual `expire` is an ACME
/// bookkeeping action; the sweep uses `System` on its own.
pub fn default_source(event: LicenseEventKind) -> EventSource {
    match event {
        LicenseEventKind::Request | LicenseEventKind::Reopen | LicenseEventKind::Expire => EventSource::Acme,
        LicenseEventKind::StartNegotiation | LicenseEventKind::Approve | LicenseEventKind::Reject => {
            EventSource::RightsHolder
        }
    }
}

/// The current state of a track's negotiation. One row per track, keyed by
/// the track id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct License {
    pub track_id: TrackId,
    pub tenant_id: TenantId,
    pub state: LicenseState,
    /// Number of applied events; the optimistic-concurrency guard.
    pub version: i32,
    /// End of the agreed term, set by `approve`; `None` means no date.
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl License {
    /// The license every track starts with.
    pub fn pending(track_id: TrackId, tenant_id: TenantId, now: DateTime<Utc>) -> Self {
        Self {
            track_id,
            tenant_id,
            state: LicenseState::Pending,
            version: 0,
            expires_at: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// One applied transition, as stored in `license_events`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LicenseEvent {
    pub id: LicenseEventId,
    pub tenant_id: TenantId,
    pub track_id: TrackId,
    /// `1..n` per license; equals the license version after the event.
    pub seq: i32,
    pub kind: LicenseEventKind,
    pub from_state: LicenseState,
    pub to_state: LicenseState,
    pub source: EventSource,
    /// The ACME user who recorded it; `None` for the expiry sweep.
    pub actor_user_id: Option<UserId>,
    /// Snapshot of the actor's name at the time.
    pub actor_name: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// What a track response embeds. `allowed_events` is derived so the UI can
/// offer exactly the legal transitions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LicenseSummary {
    pub state: LicenseState,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub allowed_events: Vec<LicenseEventKind>,
}

impl From<&License> for LicenseSummary {
    fn from(l: &License) -> Self {
        Self {
            state: l.state,
            updated_at: l.updated_at,
            expires_at: l.expires_at,
            allowed_events: allowed_events(l.state).to_vec(),
        }
    }
}

/// What the real-time stream delivers after a transition was committed: the
/// transition itself and the track as it reads now. `position` is the
/// tenant-wide cursor (`license_events.position`), the SSE `id` a client
/// resumes from. No `note` and no actor on purpose: the stream is read with
/// `movies:read`, like the status embedded in track responses; the history
/// (`licenses:read`) has the rest. Serializable both ways because it is the
/// payload of the Redis channel too.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LicenseChanged {
    pub position: i64,
    pub tenant_id: TenantId,
    pub event: LicenseEventKind,
    pub from_state: LicenseState,
    pub to_state: LicenseState,
    pub source: EventSource,
    /// Per-license sequence (the license version after the event).
    pub seq: i32,
    pub occurred_at: DateTime<Utc>,
    pub track: TrackResponse,
}

/// Body of `POST /tracks/{id}/license/{event}`. Every field is optional, so
/// `{}` is a valid body: the event itself travels in the URL.
#[derive(Debug, Default, Deserialize, Validate)]
pub struct TransitionRequest {
    #[validate(length(max = 2000))]
    pub note: Option<String>,
    /// Who decided; defaults per event (see [`default_source`]).
    pub source: Option<EventSource>,
    /// End of the term; only accepted with `approve` and must be in the future.
    pub expires_at: Option<DateTime<Utc>>,
    /// Optimistic check: the state the client last saw. A mismatch is a 409.
    pub expected_state: Option<LicenseState>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActorRef {
    pub user_id: Option<UserId>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LicenseEventResponse {
    pub id: LicenseEventId,
    pub seq: i32,
    pub event: LicenseEventKind,
    pub from_state: LicenseState,
    pub to_state: LicenseState,
    pub source: EventSource,
    /// `null` when the sweep applied the event.
    pub actor: Option<ActorRef>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<&LicenseEvent> for LicenseEventResponse {
    fn from(e: &LicenseEvent) -> Self {
        let actor = match (e.actor_user_id, &e.actor_name) {
            (None, None) => None,
            (user_id, name) => Some(ActorRef {
                user_id,
                name: name.clone(),
            }),
        };
        Self {
            id: e.id,
            seq: e.seq,
            event: e.kind,
            from_state: e.from_state,
            to_state: e.to_state,
            source: e.source,
            actor,
            note: e.note.clone(),
            created_at: e.created_at,
        }
    }
}

/// The history of one license, oldest first. Not paginated: a negotiation
/// has a handful of steps.
#[derive(Debug, Clone, Serialize)]
pub struct LicenseEventList {
    pub items: Vec<LicenseEventResponse>,
    pub count: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum LicenseError {
    /// The event is not legal in the current state (a domain rule, 422).
    #[error("Cannot {event} a license that is {state}")]
    InvalidTransition {
        state: LicenseState,
        event: LicenseEventKind,
    },
    /// The license moved since the client (or the service) read it (409).
    #[error("The license changed since it was read; reload and retry")]
    Stale { state: LicenseState },
    #[error(transparent)]
    Track(#[from] TrackError),
    #[error(transparent)]
    App(#[from] AppError),
}

impl From<LicenseError> for AppError {
    fn from(err: LicenseError) -> Self {
        match err {
            LicenseError::InvalidTransition { state, event } => {
                AppError::business("LICENSE_INVALID_TRANSITION", err.to_string())
                    .detail("state", state)
                    .detail("event", event)
                    .detail("allowed_events", allowed_events(state))
            }
            LicenseError::Stale { state } => {
                AppError::conflict("LICENSE_STATE_STALE", err.to_string()).detail("state", state)
            }
            LicenseError::Track(inner) => inner.into(),
            LicenseError::App(inner) => inner,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transition_table_is_exhaustive() {
        use LicenseEventKind as E;
        use LicenseState as S;
        let legal = [
            (S::Pending, E::Request, S::Requested),
            (S::Requested, E::StartNegotiation, S::Negotiating),
            (S::Requested, E::Reject, S::Rejected),
            (S::Negotiating, E::Approve, S::Approved),
            (S::Negotiating, E::Reject, S::Rejected),
            (S::Rejected, E::Reopen, S::Negotiating),
            (S::Approved, E::Expire, S::Expired),
        ];
        for state in S::ALL {
            for event in E::ALL {
                let expected = legal.iter().find(|(s, e, _)| (*s, *e) == (state, event)).map(|t| t.2);
                match (transition(state, event), expected) {
                    (Ok(next), Some(to)) => assert_eq!(next, to, "{state} + {event}"),
                    (Err(LicenseError::InvalidTransition { state: s, event: e }), None) => {
                        assert_eq!((s, e), (state, event));
                    }
                    (got, _) => panic!("{state} + {event}: unexpected {got:?}"),
                }
            }
        }
        // Expired is the only dead end.
        assert!(S::ALL
            .iter()
            .all(|s| (*s == S::Expired) == allowed_events(*s).is_empty()));
    }

    #[test]
    fn allowed_events_match_the_table() {
        for state in LicenseState::ALL {
            for event in LicenseEventKind::ALL {
                assert_eq!(
                    allowed_events(state).contains(&event),
                    transition(state, event).is_ok(),
                    "{state} + {event}"
                );
            }
        }
        assert_eq!(
            allowed_events(LicenseState::Requested),
            &[LicenseEventKind::StartNegotiation, LicenseEventKind::Reject]
        );
    }

    #[test]
    fn active_states_match_the_sql_list() {
        for state in LicenseState::ALL {
            let listed = ACTIVE_STATES_SQL.contains(&format!("'{state}'"));
            assert_eq!(state.is_active(), listed, "{state}");
        }
        // Every active state has a way out that frees the track.
        for state in LicenseState::ALL.into_iter().filter(|s| s.is_active()) {
            assert!(
                allowed_events(state)
                    .iter()
                    .any(|e| matches!(e, LicenseEventKind::Reject | LicenseEventKind::Expire)),
                "{state} has no reject or expire"
            );
        }
    }

    #[test]
    fn default_sources() {
        use LicenseEventKind as E;
        for event in [E::Request, E::Reopen, E::Expire] {
            assert_eq!(default_source(event), EventSource::Acme, "{event}");
        }
        for event in [E::StartNegotiation, E::Approve, E::Reject] {
            assert_eq!(default_source(event), EventSource::RightsHolder, "{event}");
        }
    }

    #[test]
    fn serde_is_snake_case() {
        assert_eq!(
            serde_json::to_string(&LicenseEventKind::StartNegotiation).unwrap(),
            "\"start_negotiation\""
        );
        assert_eq!(
            serde_json::from_str::<LicenseEventKind>("\"start_negotiation\"").unwrap(),
            LicenseEventKind::StartNegotiation
        );
        assert_eq!(
            serde_json::from_str::<LicenseState>("\"negotiating\"").unwrap(),
            LicenseState::Negotiating
        );
        assert_eq!(
            serde_json::from_str::<EventSource>("\"rights_holder\"").unwrap(),
            EventSource::RightsHolder
        );
        // `system` round-trips (published events carry it); the service is
        // what refuses it in a request body.
        assert_eq!(serde_json::to_string(&EventSource::System).unwrap(), "\"system\"");
        assert_eq!(
            serde_json::from_str::<EventSource>("\"system\"").unwrap(),
            EventSource::System
        );

        let empty: TransitionRequest = serde_json::from_str("{}").unwrap();
        assert!(empty.note.is_none() && empty.source.is_none() && empty.expires_at.is_none());
        assert!(serde_json::from_str::<TransitionRequest>("{\"source\":\"bogus\"}").is_err());
        assert!(serde_json::from_str::<TransitionRequest>("{\"expected_state\":\"bogus\"}").is_err());
    }

    #[test]
    fn summary_and_history_items_are_derived() {
        let now = Utc::now();
        let license = License::pending(TrackId::generate(), TenantId::generate(), now);
        let summary = LicenseSummary::from(&license);
        assert_eq!(summary.state, LicenseState::Pending);
        assert_eq!(summary.allowed_events, &[LicenseEventKind::Request]);
        assert_eq!(summary.expires_at, None);

        let event = LicenseEvent {
            id: LicenseEventId::generate(),
            tenant_id: license.tenant_id,
            track_id: license.track_id,
            seq: 1,
            kind: LicenseEventKind::Expire,
            from_state: LicenseState::Approved,
            to_state: LicenseState::Expired,
            source: EventSource::System,
            actor_user_id: None,
            actor_name: None,
            note: None,
            created_at: now,
        };
        let item = LicenseEventResponse::from(&event);
        assert!(item.actor.is_none());
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json["event"], "expire");
        assert_eq!(json["source"], "system");
        assert!(json["actor"].is_null());
    }

    #[test]
    fn errors_map_to_stable_codes() {
        let err = AppError::from(LicenseError::InvalidTransition {
            state: LicenseState::Requested,
            event: LicenseEventKind::Approve,
        });
        assert_eq!(
            (err.code(), err.kind().http_status()),
            ("LICENSE_INVALID_TRANSITION", 422)
        );
        assert_eq!(err.message(), "Cannot approve a license that is requested");
        assert_eq!(err.details()["state"], "requested");
        assert_eq!(err.details()["event"], "approve");
        assert_eq!(
            err.details()["allowed_events"],
            serde_json::json!(["start_negotiation", "reject"])
        );

        let err = AppError::from(LicenseError::Stale {
            state: LicenseState::Approved,
        });
        assert_eq!((err.code(), err.kind().http_status()), ("LICENSE_STATE_STALE", 409));
        assert_eq!(err.details()["state"], "approved");

        let err = AppError::from(LicenseError::Track(TrackError::NotFound));
        assert_eq!(err.code(), "TRACK_NOT_FOUND");
    }
}
