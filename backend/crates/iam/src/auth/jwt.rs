//! Access tokens are short-lived HS256 JWTs. They carry the scopes resolved
//! at issuance; removing a grant takes effect on the next refresh.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use errx::AppError;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use kernel::{SessionId, TenantId, UserId};
use serde::{Deserialize, Serialize};

use crate::config::JwtConfig;
use crate::user::User;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// User id.
    pub sub: UserId,
    /// Tenant id.
    pub tid: TenantId,
    /// Session id.
    pub sid: SessionId,
    pub email: String,
    pub name: String,
    pub scopes: Vec<String>,
    /// Credential version at issuance; must match the stored user.
    pub cv: i64,
    pub iss: String,
    pub aud: Vec<String>,
    pub iat: u64,
    pub exp: u64,
    pub jti: String,
}

pub struct JwtService {
    encoding: EncodingKey,
    decoding: DecodingKey,
    validation: Validation,
    issuer: String,
    audience: Vec<String>,
    access_ttl: Duration,
}

impl JwtService {
    pub fn new(cfg: &JwtConfig) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[cfg.issuer.as_str()]);
        validation.set_audience(&cfg.audience);
        validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
        validation.leeway = 5;
        Self {
            encoding: EncodingKey::from_secret(cfg.secret.as_bytes()),
            decoding: DecodingKey::from_secret(cfg.secret.as_bytes()),
            validation,
            issuer: cfg.issuer.clone(),
            audience: cfg.audience.clone(),
            access_ttl: cfg.access_ttl,
        }
    }

    pub fn access_ttl(&self) -> Duration {
        self.access_ttl
    }

    /// Returns the signed token and its lifetime in seconds.
    pub fn issue(&self, user: &User, session_id: SessionId, scopes: Vec<String>) -> Result<(String, u64), AppError> {
        let now = unix_now();
        let ttl = self.access_ttl.as_secs();
        let claims = Claims {
            sub: user.id,
            tid: user.tenant_id,
            sid: session_id,
            email: user.email.clone(),
            name: user.name.clone(),
            scopes,
            cv: user.credential_version,
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
            iat: now,
            exp: now + ttl,
            jti: uuid::Uuid::new_v4().to_string(),
        };
        let token = encode(&Header::new(Algorithm::HS256), &claims, &self.encoding)
            .map_err(|e| AppError::internal("Token generation failed").with_source(e))?;
        Ok((token, ttl))
    }

    pub fn validate(&self, token: &str) -> Result<Claims, AppError> {
        decode::<Claims>(token, &self.decoding, &self.validation)
            .map(|data| data.claims)
            .map_err(|e| {
                tracing::debug!(error = %e, "access token rejected");
                AppError::unauthorized()
            })
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;
    use crate::user::UserStatus;

    fn config() -> JwtConfig {
        JwtConfig {
            secret: "0123456789abcdef0123456789abcdef".into(),
            issuer: "test".into(),
            audience: vec!["test-api".into()],
            access_ttl: Duration::from_secs(60),
            refresh_ttl: Duration::from_secs(600),
        }
    }

    fn user() -> User {
        let now = Utc::now();
        User {
            id: UserId::generate(),
            tenant_id: TenantId::generate(),
            email: "a@b.co".into(),
            name: "Ana".into(),
            status: UserStatus::Active,
            scopes: vec!["users:read".into()],
            credential_version: 3,
            email_verified: true,
            otp_enabled: true,
            last_login_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn round_trip() {
        let svc = JwtService::new(&config());
        let u = user();
        let sid = SessionId::generate();
        let (token, ttl) = svc.issue(&u, sid, vec!["users:*".into()]).unwrap();
        assert_eq!(ttl, 60);
        let claims = svc.validate(&token).unwrap();
        assert_eq!(claims.sub, u.id);
        assert_eq!(claims.tid, u.tenant_id);
        assert_eq!(claims.sid, sid);
        assert_eq!(claims.cv, 3);
        assert_eq!(claims.scopes, vec!["users:*".to_string()]);
    }

    #[test]
    fn rejects_other_secret_issuer_or_audience() {
        let svc = JwtService::new(&config());
        let (token, _) = svc.issue(&user(), SessionId::generate(), vec![]).unwrap();

        let mut other = config();
        other.secret = "ffffffffffffffffffffffffffffffff".into();
        assert!(JwtService::new(&other).validate(&token).is_err());

        let mut other = config();
        other.issuer = "someone-else".into();
        assert!(JwtService::new(&other).validate(&token).is_err());

        let mut other = config();
        other.audience = vec!["other-api".into()];
        assert!(JwtService::new(&other).validate(&token).is_err());

        assert!(svc.validate("not.a.jwt").is_err());
    }
}
