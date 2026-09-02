use bcrypt::{DEFAULT_COST, hash, verify};

use crate::error::AppError;
use crate::iam::user::PasswordService;

pub struct BcryptPasswordService;

impl Default for BcryptPasswordService {
    fn default() -> Self {
        Self::new()
    }
}

impl BcryptPasswordService {
    pub fn new() -> Self {
        Self
    }
}

impl PasswordService for BcryptPasswordService {
    fn hash_password(&self, password: &str) -> Result<String, AppError> {
        hash(password, DEFAULT_COST)
            .map_err(|e| AppError::internal(format!("Failed to hash password: {e}")))
    }

    fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AppError> {
        verify(password, hash)
            .map_err(|e| AppError::internal(format!("Failed to verify password: {e}")))
    }
}
