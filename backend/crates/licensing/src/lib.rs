//! Music licensing bounded context (scaffold).
//!
//! ACME BROS PICTURES licenses songs for the scenes of its movies. A movie
//! has scenes, a scene has tracks, a track references a song, and each
//! track carries a license request that moves through a workflow. Nothing
//! is implemented yet: every module below documents what belongs in it and
//! follows the same shape as the `iam` crate
//! (`mod.rs / port.rs / service.rs / infra/ / api/`).
//!
//! Start with `movie`, then `scene`, `song`, `track` and finally `license`.
//! The step-by-step guide lives in `docs/architecture.md`.

pub mod license;
pub mod movie;
pub mod scene;
pub mod song;
pub mod track;

mod container;

pub use container::{Container, Deps};
