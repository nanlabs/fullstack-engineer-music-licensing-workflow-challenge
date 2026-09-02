use crate::error::{AppError, ErrorType};

pub struct MovieError;

impl MovieError {
    pub fn not_found() -> AppError {
        AppError::new("movie.not_found", "Movie not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "movie.already_exists",
            "Movie already exists",
            ErrorType::Conflict,
        )
    }

    pub fn member_already_added() -> AppError {
        AppError::new(
            "movie.member_already_added",
            "User is already a member of this movie",
            ErrorType::Conflict,
        )
    }

    pub fn member_not_found() -> AppError {
        AppError::new(
            "movie.member_not_found",
            "User is not a member of this movie",
            ErrorType::NotFound,
        )
    }

    pub fn not_authorized() -> AppError {
        AppError::new(
            "movie.not_authorized",
            "Not authorized to perform this action on this movie",
            ErrorType::Authorization,
        )
    }
}
