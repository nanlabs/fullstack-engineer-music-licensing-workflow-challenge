use crate::error::{AppError, ErrorType};

pub struct LabelError;

impl LabelError {
    pub fn not_found() -> AppError {
        AppError::new("label.not_found", "Label not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "label.already_exists",
            "Label with this name already exists",
            ErrorType::Conflict,
        )
    }

    pub fn member_already_added() -> AppError {
        AppError::new(
            "label.member_already_added",
            "User is already a member of this label",
            ErrorType::Conflict,
        )
    }

    pub fn member_not_found() -> AppError {
        AppError::new(
            "label.member_not_found",
            "User is not a member of this label",
            ErrorType::NotFound,
        )
    }
}
