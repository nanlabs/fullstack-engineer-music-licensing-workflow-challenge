use crate::error::{AppError, ErrorType};

pub struct AuthError;

impl AuthError {
    pub fn unauthorized() -> AppError {
        AppError::new(
            "auth.unauthorized",
            "Unauthorized",
            ErrorType::Authorization,
        )
    }

    pub fn invalid_credentials() -> AppError {
        AppError::new(
            "auth.invalid_credentials",
            "Invalid email or password",
            ErrorType::Authorization,
        )
    }

    pub fn account_disabled() -> AppError {
        AppError::new(
            "auth.account_disabled",
            "Account is not active",
            ErrorType::Authorization,
        )
    }

    pub fn invalid_refresh_token() -> AppError {
        AppError::new(
            "auth.invalid_refresh_token",
            "Invalid refresh token",
            ErrorType::Authorization,
        )
    }

    pub fn expired_refresh_token() -> AppError {
        AppError::new(
            "auth.expired_refresh_token",
            "Refresh token has expired",
            ErrorType::Authorization,
        )
    }

    pub fn invalid_oauth_provider() -> AppError {
        AppError::new(
            "auth.invalid_oauth_provider",
            "Invalid OAuth provider",
            ErrorType::Validation,
        )
    }

    pub fn oauth_failed() -> AppError {
        AppError::new(
            "auth.oauth_failed",
            "OAuth authentication failed",
            ErrorType::External,
        )
    }

    pub fn token_generation_failed() -> AppError {
        AppError::new(
            "auth.token_generation_failed",
            "Failed to generate token",
            ErrorType::Internal,
        )
    }

    pub fn token_validation_failed() -> AppError {
        AppError::new(
            "auth.token_validation_failed",
            "Token validation failed",
            ErrorType::Authorization,
        )
    }

    pub fn access_denied() -> AppError {
        AppError::new(
            "auth.access_denied",
            "Insufficient permissions",
            ErrorType::Authorization,
        )
    }
}
