use std::time::Duration;

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub jwt: JWTConfig,
    pub oauth: OAuthConfigs,
}

#[derive(Debug, Clone)]
pub struct JWTConfig {
    pub secret_key: String,
    pub access_token_ttl: Duration,
    pub refresh_token_ttl: Duration,
    pub issuer: String,
}

#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_url: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct OAuthConfigs {
    pub google: Option<OAuthConfig>,
    pub microsoft: Option<OAuthConfig>,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt: JWTConfig {
                secret_key: String::new(),
                access_token_ttl: Duration::from_secs(15 * 60), // 15 minutes
                refresh_token_ttl: Duration::from_secs(7 * 24 * 3600), // 7 days
                issuer: "backend".to_string(),
            },
            oauth: OAuthConfigs::default(),
        }
    }
}

impl AuthConfig {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.jwt.secret_key.is_empty() {
            return Err(AppError::validation("JWT secret key is required"));
        }
        if self.jwt.secret_key.len() < 32 {
            return Err(AppError::validation(
                "JWT secret key must be at least 32 characters",
            ));
        }
        Ok(())
    }
}

impl OAuthConfig {
    pub fn is_enabled(&self) -> bool {
        !self.client_id.is_empty() && !self.client_secret.is_empty()
    }
}

impl OAuthConfigs {
    pub fn get_enabled_providers(&self) -> Vec<&str> {
        let mut enabled = Vec::new();
        if let Some(g) = &self.google
            && g.is_enabled()
        {
            enabled.push("google");
        }
        if let Some(m) = &self.microsoft
            && m.is_enabled()
        {
            enabled.push("microsoft");
        }
        enabled
    }
}
