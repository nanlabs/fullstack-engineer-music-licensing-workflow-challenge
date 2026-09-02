use crate::error::{AppError, ErrorType};

pub struct UserError;

impl UserError {
    pub fn not_found() -> AppError {
        AppError::new("user.not_found", "User not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "user.already_exists",
            "User already exists",
            ErrorType::Conflict,
        )
    }

    pub fn invalid_credentials() -> AppError {
        AppError::new(
            "user.invalid_credentials",
            "Invalid credentials",
            ErrorType::Authorization,
        )
    }

    pub fn email_not_verified() -> AppError {
        AppError::new(
            "user.email_not_verified",
            "Email not verified",
            ErrorType::Business,
        )
    }

    pub fn suspended() -> AppError {
        AppError::new("user.suspended", "User suspended", ErrorType::Authorization)
    }

    pub fn onboarding_required() -> AppError {
        AppError::new(
            "user.onboarding_required",
            "Onboarding required",
            ErrorType::Business,
        )
    }

    pub fn invalid_status() -> AppError {
        AppError::new(
            "user.invalid_status",
            "Invalid user status for this operation",
            ErrorType::Business,
        )
    }
}
