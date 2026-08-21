//! Music Licensing Workflow API.
//!
//! The crate is split into a library and a thin binary so that integration
//! tests can build the same router the binary serves.

pub mod api;
pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;
pub mod server;
pub mod telemetry;
