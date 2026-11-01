//! License workflow: the stateful negotiation attached to a track.
//!
//! Model the workflow as an explicit state machine in `mod.rs`, for example
//! `Draft → Requested → UnderNegotiation → (Approved | Rejected)` plus
//! `Approved → Expired`, with a `transition(from, event) -> Result<to, LicenseError>`
//! function that is unit-tested without a database. Persist every transition
//! in a `license_events` table (who, when, from, to, note) so the UI can show
//! history, and emit a domain event so the real-time channel can fan it out.
//! Scope checks: `licenses:read` to view, `licenses:write` to transition.
