use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::iam::auth::config::JWTConfig;
use crate::iam::auth::error::AuthError;
use crate::iam::auth::model::TokenClaims;
use crate::iam::auth::port::TokenService;
use crate::kernel::UserId;

// ============================================================================
// JWT Claims (serde representation for jsonwebtoken crate)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct AccessClaims {
    sub: String, // user_id
    email: String,
    name: String,
    scopes: Vec<String>,
    iss: String,
    exp: usize,
    iat: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct RefreshClaims {
    sub: String, // user_id
    jti: String, // unique token id to prevent collisions
    iss: String,
    exp: usize,
    iat: usize,
}

// ============================================================================
// JwtTokenService
// ============================================================================

pub struct JwtTokenService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    access_ttl_secs: usize,
    refresh_ttl_secs: usize,
    issuer: String,
}

impl JwtTokenService {
    pub fn new(config: &JWTConfig) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(config.secret_key.as_bytes()),
            decoding_key: DecodingKey::from_secret(config.secret_key.as_bytes()),
            access_ttl_secs: config.access_token_ttl.as_secs() as usize,
            refresh_ttl_secs: config.refresh_token_ttl.as_secs() as usize,
            issuer: config.issuer.clone(),
        }
    }

    fn validation(&self) -> Validation {
        let mut v = Validation::default();
        v.set_issuer(&[&self.issuer]);
        v.set_required_spec_claims(&["exp", "iat", "iss", "sub"]);
        v
    }
}

impl TokenService for JwtTokenService {
    fn generate_access_token(&self, claims: &TokenClaims) -> Result<String, AppError> {
        let now = chrono::Utc::now().timestamp() as usize;
        let jwt_claims = AccessClaims {
            sub: claims.user_id.to_string(),
            email: claims.email.clone(),
            name: claims.name.clone(),
            scopes: claims.scopes.clone(),
            iss: self.issuer.clone(),
            exp: now + self.access_ttl_secs,
            iat: now,
        };

        encode(&Header::default(), &jwt_claims, &self.encoding_key)
            .map_err(|e| AuthError::token_generation_failed().with_detail("error", e.to_string()))
    }

    fn validate_access_token(&self, token: &str) -> Result<TokenClaims, AppError> {
        let data =
            decode::<AccessClaims>(token, &self.decoding_key, &self.validation()).map_err(|e| {
                AuthError::token_validation_failed().with_detail("error", e.to_string())
            })?;

        Ok(TokenClaims {
            user_id: UserId::from_string(data.claims.sub),
            email: data.claims.email,
            name: data.claims.name,
            scopes: data.claims.scopes,
        })
    }

    fn generate_refresh_token(&self, user_id: &UserId) -> Result<String, AppError> {
        let now = chrono::Utc::now().timestamp() as usize;
        let claims = RefreshClaims {
            sub: user_id.to_string(),
            jti: uuid::Uuid::new_v4().to_string(),
            iss: self.issuer.clone(),
            exp: now + self.refresh_ttl_secs,
            iat: now,
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::token_generation_failed().with_detail("error", e.to_string()))
    }

    fn validate_refresh_token(&self, token: &str) -> Result<UserId, AppError> {
        let data = decode::<RefreshClaims>(token, &self.decoding_key, &self.validation()).map_err(
            |e| AuthError::token_validation_failed().with_detail("error", e.to_string()),
        )?;

        Ok(UserId::from_string(data.claims.sub))
    }
}
