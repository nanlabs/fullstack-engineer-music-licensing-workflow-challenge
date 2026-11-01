//! Identity and access management bounded context.
//!
//! Modules follow the same shape: entities and DTOs in `mod.rs`, required
//! contracts in `port.rs`, use cases in `service.rs`, adapters in `infra/`
//! and HTTP transport in `api/`. Services receive an explicit
//! [`kernel::AuthContext`] and call [`authz::require`] before touching a
//! repository. Every repository query is constrained by tenant.

pub mod auth;
pub mod authz;
pub mod config;
pub mod invitation;
pub mod otp;
pub mod role;
pub mod scopes;
pub mod tenant;
pub mod user;

mod container;

pub use config::IamConfig;
pub use container::{Container, Deps};
