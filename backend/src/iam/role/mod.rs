pub mod adapters;
mod error;
pub mod model;
mod port;
mod service;

pub use error::RoleError;
pub use model::{
    AssignRoleRequest, CreateRoleRequest, Role, RoleResponse, UpdateRoleRequest, UserRole,
    UserRolesResponse,
};
pub use port::RoleRepository;
pub use service::RoleService;
