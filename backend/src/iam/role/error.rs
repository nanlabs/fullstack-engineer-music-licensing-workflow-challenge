use crate::error::{AppError, ErrorType};

pub struct RoleError;

impl RoleError {
    pub fn not_found() -> AppError {
        AppError::new("role.not_found", "Role not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "role.already_exists",
            "Role with this name already exists",
            ErrorType::Conflict,
        )
    }

    pub fn invalid_scopes() -> AppError {
        AppError::new(
            "role.invalid_scopes",
            "Invalid scopes provided",
            ErrorType::Validation,
        )
    }

    pub fn already_assigned() -> AppError {
        AppError::new(
            "role.already_assigned",
            "Role already assigned to user",
            ErrorType::Conflict,
        )
    }

    pub fn not_assigned() -> AppError {
        AppError::new(
            "role.not_assigned",
            "Role not assigned to user",
            ErrorType::NotFound,
        )
    }
}
