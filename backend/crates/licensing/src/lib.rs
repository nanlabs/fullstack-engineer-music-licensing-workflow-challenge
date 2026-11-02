//! Music licensing bounded context.
//!
//! ACME BROS PICTURES licenses songs for the scenes of its movies. A movie
//! has scenes, a scene has tracks, a track references a song, and each
//! track carries a license request that moves through a workflow.
//!
//! `movie`, `scene`, `song`, `track` and `license` are implemented; `movie`
//! is the reference for the module shape (`mod.rs / port.rs / service.rs /
//! infra/ / api/`), identical to the `iam` crate, `scene` shows how a child
//! entity hangs from its parent, `song` a tenant-wide catalogue with
//! constraint-backed invariants, `track` a child that references another
//! module's rows and is read through a joined view, `license` a state
//! machine with an append-only event log and a background sweep, and
//! `events` the real-time delivery of license changes (Server-Sent Events
//! over the event log, with Redis pub/sub between instances). The
//! step-by-step guide lives in `docs/architecture.md`; the domain model and
//! workflow in `docs/licensing.md`.

pub mod events;
pub mod license;
pub mod movie;
pub mod scene;
pub mod song;
pub mod track;

/// Infrastructure helpers shared by the Postgres adapters.
pub mod db;
/// Text normalization shared by every module.
pub mod text;

mod container;
#[cfg(test)]
mod testing;

pub use container::{Container, Deps};
pub use events::EventsConfig;
pub use license::config::LicensingConfig;
