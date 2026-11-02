//! Shared primitives used by every bounded context.
//!
//! This crate must never depend on a business module or on an HTTP framework.
//! It holds the vocabulary that modules use to talk to each other: typed ids,
//! the request actor, the authenticated context, scope matching and pagination.

pub mod actor;
pub mod auth_context;
pub mod ids;
pub mod json;
pub mod page;
pub mod scope;

pub use actor::Actor;
pub use auth_context::AuthContext;
pub use ids::*;
pub use page::{PageInfo, PageQuery, Paginated};
