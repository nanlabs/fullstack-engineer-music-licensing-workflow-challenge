use crate::error::{AppError, ErrorType};

pub struct TrackError;

impl TrackError {
    pub fn not_found() -> AppError {
        AppError::new("track.not_found", "Track not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "track.already_exists",
            "This song is already placed in this scene",
            ErrorType::Conflict,
        )
    }

    pub fn not_authorized() -> AppError {
        AppError::new(
            "track.not_authorized",
            "Not authorized to perform this action on this track",
            ErrorType::Authorization,
        )
    }
}
