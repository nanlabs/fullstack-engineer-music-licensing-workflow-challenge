use crate::error::{AppError, ErrorType};

pub struct SongError;

impl SongError {
    pub fn not_found() -> AppError {
        AppError::new("song.not_found", "Song not found", ErrorType::NotFound)
    }

    pub fn already_exists() -> AppError {
        AppError::new(
            "song.already_exists",
            "Song already exists",
            ErrorType::Conflict,
        )
    }
}
