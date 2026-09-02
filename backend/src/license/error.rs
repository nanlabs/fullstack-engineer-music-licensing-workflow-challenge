use crate::error::{AppError, ErrorType};
use crate::kernel::UserId;

pub struct LicenseError;

impl LicenseError {
    pub fn not_found() -> AppError {
        AppError::new(
            "license.not_found",
            "License request not found",
            ErrorType::NotFound,
        )
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "license.already_exists",
            "A license request already exists for this track",
            ErrorType::Conflict,
        )
    }

    pub fn invalid_transition(from: &str, to: &str) -> AppError {
        AppError::new(
            "license.invalid_transition",
            format!("Cannot transition from {from} to {to}"),
            ErrorType::Business,
        )
    }

    pub fn not_authorized(actor: &UserId) -> AppError {
        AppError::new(
            "license.not_authorized",
            format!(
                "User {} is not authorized to perform this action",
                actor.as_str()
            ),
            ErrorType::Authorization,
        )
    }

    pub fn own_offer(actor: &UserId) -> AppError {
        AppError::new(
            "license.own_offer",
            format!(
                "User {} cannot act on an offer made by their own side",
                actor.as_str()
            ),
            ErrorType::Business,
        )
    }

    pub fn no_offer() -> AppError {
        AppError::new(
            "license.no_offer",
            "License request has no offers",
            ErrorType::Business,
        )
    }
}
