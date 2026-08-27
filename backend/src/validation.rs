//! Business rules for track input that do not need the database.

use crate::error::AppError;

/// Checks that a track's timings describe a real, forward-running span within
/// the scene. Offsets are measured in seconds from the start of the scene.
pub fn validate_track_times(
    start_time_seconds: i32,
    end_time_seconds: i32,
) -> Result<(), AppError> {
    if start_time_seconds < 0 || end_time_seconds < 0 {
        return Err(AppError::Validation("Times cannot be negative".to_string()));
    }

    if start_time_seconds >= end_time_seconds {
        return Err(AppError::Validation(
            "start_time_seconds must be less than end_time_seconds".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_validation_error(result: Result<(), AppError>) -> bool {
        matches!(result, Err(AppError::Validation(_)))
    }

    #[test]
    fn accepts_a_forward_running_span() {
        assert!(validate_track_times(0, 95).is_ok());
        assert!(validate_track_times(120, 210).is_ok());
    }

    #[test]
    fn rejects_negative_times() {
        assert!(is_validation_error(validate_track_times(-1, 95)));
        assert!(is_validation_error(validate_track_times(0, -95)));
    }

    #[test]
    fn rejects_an_end_before_the_start() {
        assert!(is_validation_error(validate_track_times(90, 30)));
    }

    #[test]
    fn rejects_a_zero_length_track() {
        assert!(is_validation_error(validate_track_times(60, 60)));
    }
}
