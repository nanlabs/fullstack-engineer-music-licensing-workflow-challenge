//! Bearer-token authentication and development token issuance.
//!
//! # This is not a production authentication system
//!
//! `POST /auth/dev-token` mints a token for any display name the caller asks
//! for: there are no credentials, so anyone can claim to be anyone. It exists
//! to demonstrate issuance, validation, route protection, and actor
//! attribution. A real deployment replaces this one endpoint with an identity
//! provider and keeps everything else — bearer validation, the extractor, and
//! the actor recorded on every event — unchanged.
//!
//! Because of that, the endpoint is mounted only when
//! `DEV_TOKEN_ENDPOINT_ENABLED` is on. When it is off the route does not exist
//! at all, so requests get the API's ordinary `404 resource_not_found` rather
//! than a `403` that would confirm the endpoint is there.

use std::sync::Arc;
use std::time::Duration;

use axum::extract::{FromRef, FromRequestParts, State};
use axum::http::request::Parts;
use axum::http::{header, StatusCode};
use axum::Json;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::error::{ApiError, ProblemCode};
use crate::api::AppState;
use crate::config::Config;
use crate::domain::actor::{Actor, InvalidDisplayName};

/// Tolerated clock skew between the issuer and this process.
const CLOCK_SKEW_LEEWAY: Duration = Duration::from_secs(5);

const ALGORITHM: Algorithm = Algorithm::HS256;

/// Keys and validation rules, built once at startup.
///
/// Held behind an `Arc` because `DecodingKey` and `EncodingKey` are relatively
/// expensive to construct and are needed on every request.
pub struct AuthContext {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    validation: Validation,
    issuer: String,
    audience: String,
    token_ttl: Duration,
}

impl AuthContext {
    pub fn from_config(config: &Config) -> Self {
        let secret = config.jwt_secret.expose().as_bytes();

        let mut validation = Validation::new(ALGORITHM);
        validation.set_issuer(&[config.jwt_issuer.as_str()]);
        validation.set_audience(&[config.jwt_audience.as_str()]);
        validation.leeway = CLOCK_SKEW_LEEWAY.as_secs();
        // Signature, expiry, issuer, and audience are all required. `exp` is
        // validated by default; stating it keeps the intent visible.
        validation.validate_exp = true;
        validation.required_spec_claims = ["exp", "iss", "aud", "sub"]
            .iter()
            .map(|c| c.to_string())
            .collect();

        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
            validation,
            issuer: config.jwt_issuer.clone(),
            audience: config.jwt_audience.clone(),
            token_ttl: config.jwt_token_ttl,
        }
    }

    /// Signs a token for an actor. Returns the token and its lifetime.
    fn issue(&self, actor: &Actor) -> Result<(String, u64), jsonwebtoken::errors::Error> {
        let issued_at = chrono::Utc::now();
        let expires_at = issued_at + chrono::Duration::from_std(self.token_ttl).expect("valid ttl");

        let claims = Claims {
            sub: actor.id,
            name: actor.name.clone(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
            iat: issued_at.timestamp(),
            exp: expires_at.timestamp(),
        };

        let token = encode(&Header::new(ALGORITHM), &claims, &self.encoding_key)?;

        Ok((token, self.token_ttl.as_secs()))
    }

    /// Verifies a token's signature, issuer, audience, and expiry.
    fn verify(&self, token: &str) -> Result<Claims, ApiError> {
        decode::<Claims>(token, &self.decoding_key, &self.validation)
            .map(|data| data.claims)
            .map_err(|error| {
                // The specific reason is logged but not returned: telling a
                // caller *why* their token failed helps an attacker more than
                // it helps a client.
                tracing::debug!(error = %error, "rejected bearer token");
                invalid_token("The bearer token is missing, malformed, or expired.")
            })
    }
}

/// Claims carried by every token.
///
/// `name` is signed, which is what lets track history record a readable actor
/// name without an identity table to join against.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub name: String,
    pub iss: String,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
}

fn invalid_token(detail: &str) -> ApiError {
    ApiError::new(ProblemCode::InvalidToken, detail).with_bearer_challenge()
}

/// An authenticated caller.
///
/// Declaring this extractor in a handler's signature is what protects the
/// route: protection is a property of the type, not of a middleware list that
/// someone could forget to update when adding a route.
#[derive(Debug, Clone)]
pub struct AuthenticatedActor(pub Actor);

impl<S> FromRequestParts<S> for AuthenticatedActor
where
    Arc<AuthContext>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = Arc::<AuthContext>::from_ref(state);

        let header_value = parts
            .headers
            .get(header::AUTHORIZATION)
            .ok_or_else(|| invalid_token("An `Authorization: Bearer <token>` header is required."))?
            .to_str()
            .map_err(|_| invalid_token("The `Authorization` header is not valid text."))?;

        // The scheme is matched case-insensitively, as RFC 7235 requires.
        let token = header_value
            .split_once(' ')
            .filter(|(scheme, _)| scheme.eq_ignore_ascii_case("Bearer"))
            .map(|(_, token)| token.trim())
            .filter(|token| !token.is_empty())
            .ok_or_else(|| {
                invalid_token("The `Authorization` header must use the Bearer scheme.")
            })?;

        let claims = auth.verify(token)?;

        Ok(Self(Actor::from_claims(claims.sub, claims.name)))
    }
}

#[derive(Debug, Deserialize)]
pub struct DevTokenRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct DevTokenResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_in: u64,
    /// Echoed so a caller can see the actor ID their name resolved to.
    pub actor_id: Uuid,
    pub actor_name: String,
}

/// `POST /auth/dev-token` — issues a development token for a display name.
pub async fn issue_dev_token(
    State(state): State<AppState>,
    Json(request): Json<DevTokenRequest>,
) -> Result<(StatusCode, Json<DevTokenResponse>), ApiError> {
    let actor = Actor::from_display_name(&request.name).map_err(|error| match error {
        InvalidDisplayName::Empty => {
            ApiError::new(ProblemCode::ValidationFailed, "`name` must not be empty.")
        }
        InvalidDisplayName::TooLong => ApiError::new(
            ProblemCode::ValidationFailed,
            format!(
                "`name` must not exceed {} characters.",
                crate::domain::actor::MAX_DISPLAY_NAME_CHARS
            ),
        ),
        InvalidDisplayName::ControlCharacters => ApiError::new(
            ProblemCode::ValidationFailed,
            "`name` must not contain control characters.",
        ),
    })?;

    let (access_token, expires_in) = state.auth.issue(&actor).map_err(|error| {
        tracing::error!(error = %error, "failed to sign a development token");
        ApiError::new(ProblemCode::InternalError, "The token could not be issued.")
    })?;

    tracing::info!(actor_id = %actor.id, "issued development token");

    Ok((
        StatusCode::CREATED,
        Json(DevTokenResponse {
            access_token,
            token_type: "Bearer",
            expires_in,
            actor_id: actor.id,
            actor_name: actor.name,
        }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(issuer: &str, audience: &str, ttl: Duration) -> AuthContext {
        let mut config = test_config();
        config.jwt_issuer = issuer.to_string();
        config.jwt_audience = audience.to_string();
        config.jwt_token_ttl = ttl;
        AuthContext::from_config(&config)
    }

    fn test_config() -> Config {
        // Built by hand rather than from the environment: these tests are about
        // token rules, not configuration parsing.
        Config {
            bind_address: "127.0.0.1:0".parse().unwrap(),
            database: crate::config::DatabaseConfig {
                url: crate::config::Secret::for_test("postgres://unused"),
                max_connections: 1,
                acquire_timeout: Duration::from_secs(1),
            },
            jwt_secret: crate::config::Secret::for_test("a-test-secret-of-sufficient-length!!"),
            jwt_issuer: "music-licensing-api".to_string(),
            jwt_audience: "music-licensing-clients".to_string(),
            jwt_token_ttl: Duration::from_secs(3600),
            dev_token_endpoint_enabled: true,
            cors_allowed_origins: Vec::new(),
            sse_max_connections: 1,
        }
    }

    #[test]
    fn round_trips_a_token() {
        let auth = context(
            "music-licensing-api",
            "music-licensing-clients",
            Duration::from_secs(3600),
        );
        let actor = Actor::from_display_name("Ada Lovelace").unwrap();

        let (token, expires_in) = auth.issue(&actor).unwrap();
        let claims = auth.verify(&token).unwrap();

        assert_eq!(expires_in, 3600);
        assert_eq!(claims.sub, actor.id);
        assert_eq!(claims.name, "Ada Lovelace");
        assert_eq!(claims.iss, "music-licensing-api");
        assert_eq!(claims.aud, "music-licensing-clients");
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn rejects_a_token_signed_with_another_key() {
        let issuer = context(
            "music-licensing-api",
            "music-licensing-clients",
            Duration::from_secs(3600),
        );
        let actor = Actor::from_display_name("Ada").unwrap();
        let (token, _) = issuer.issue(&actor).unwrap();

        let mut other_config = test_config();
        other_config.jwt_secret =
            crate::config::Secret::for_test("a-different-secret-of-sufficient-len");
        let verifier = AuthContext::from_config(&other_config);

        assert!(verifier.verify(&token).is_err());
    }

    #[test]
    fn rejects_a_token_from_another_issuer_or_audience() {
        let actor = Actor::from_display_name("Ada").unwrap();
        let verifier = context(
            "music-licensing-api",
            "music-licensing-clients",
            Duration::from_secs(3600),
        );

        let wrong_issuer = context(
            "someone-else",
            "music-licensing-clients",
            Duration::from_secs(3600),
        );
        let (token, _) = wrong_issuer.issue(&actor).unwrap();
        assert!(verifier.verify(&token).is_err(), "issuer must be checked");

        let wrong_audience = context(
            "music-licensing-api",
            "another-api",
            Duration::from_secs(3600),
        );
        let (token, _) = wrong_audience.issue(&actor).unwrap();
        assert!(verifier.verify(&token).is_err(), "audience must be checked");
    }

    #[test]
    fn rejects_an_expired_token() {
        // Well past the 5-second leeway.
        let auth = context(
            "music-licensing-api",
            "music-licensing-clients",
            Duration::from_secs(0),
        );
        let actor = Actor::from_display_name("Ada").unwrap();
        let (token, _) = auth.issue(&actor).unwrap();

        let claims = Claims {
            sub: actor.id,
            name: actor.name.clone(),
            iss: "music-licensing-api".to_string(),
            aud: "music-licensing-clients".to_string(),
            iat: (chrono::Utc::now() - chrono::Duration::hours(2)).timestamp(),
            exp: (chrono::Utc::now() - chrono::Duration::hours(1)).timestamp(),
        };
        let expired = encode(&Header::new(ALGORITHM), &claims, &auth.encoding_key).unwrap();

        assert!(auth.verify(&expired).is_err());
        // A zero-TTL token is still within leeway, so it must remain valid.
        assert!(auth.verify(&token).is_ok());
    }

    #[test]
    fn rejects_malformed_tokens() {
        let auth = context(
            "music-licensing-api",
            "music-licensing-clients",
            Duration::from_secs(3600),
        );

        assert!(auth.verify("").is_err());
        assert!(auth.verify("not.a.token").is_err());
        assert!(auth.verify("Bearer").is_err());
    }
}
