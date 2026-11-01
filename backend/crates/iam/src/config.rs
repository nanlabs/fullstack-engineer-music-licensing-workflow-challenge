use std::time::Duration;

use actix_web::cookie::SameSite;
use anyhow::{bail, Context};

#[derive(Debug, Clone)]
pub struct IamConfig {
    pub jwt: JwtConfig,
    pub otp: OtpConfig,
    pub session: SessionConfig,
    pub invitation: InvitationConfig,
    pub cookie: CookieConfig,
}

#[derive(Debug, Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub issuer: String,
    pub audience: Vec<String>,
    pub access_ttl: Duration,
    pub refresh_ttl: Duration,
}

#[derive(Debug, Clone)]
pub struct OtpConfig {
    pub code_length: u8,
    pub ttl: Duration,
    pub max_attempts: i32,
    /// Minimum time between two codes for the same contact and purpose.
    pub rate_limit_window: Duration,
}

#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub max_per_user: i64,
    pub cleanup_interval: Duration,
}

#[derive(Debug, Clone)]
pub struct InvitationConfig {
    pub ttl: Duration,
}

#[derive(Debug, Clone)]
pub struct CookieConfig {
    pub access_token_name: String,
    pub refresh_token_name: String,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: SameSite,
    pub domain: Option<String>,
    pub path: String,
}

impl IamConfig {
    /// Development defaults. The secret is still mandatory.
    pub fn development(secret: impl Into<String>) -> Self {
        Self {
            jwt: JwtConfig {
                secret: secret.into(),
                issuer: "music-licensing".into(),
                audience: vec!["music-licensing-api".into()],
                access_ttl: Duration::from_secs(15 * 60),
                refresh_ttl: Duration::from_secs(7 * 24 * 60 * 60),
            },
            otp: OtpConfig {
                code_length: 6,
                ttl: Duration::from_secs(10 * 60),
                max_attempts: 5,
                rate_limit_window: Duration::from_secs(60),
            },
            session: SessionConfig {
                max_per_user: 10,
                cleanup_interval: Duration::from_secs(60 * 60),
            },
            invitation: InvitationConfig {
                ttl: Duration::from_secs(7 * 24 * 60 * 60),
            },
            cookie: CookieConfig {
                access_token_name: "access_token".into(),
                refresh_token_name: "refresh_token".into(),
                secure: false,
                http_only: true,
                same_site: SameSite::Lax,
                domain: None,
                path: "/".into(),
            },
        }
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if self.jwt.secret.len() < 32 {
            bail!("JWT_SECRET must be at least 32 bytes long");
        }
        if !(4..=10).contains(&self.otp.code_length) {
            bail!("OTP_CODE_LENGTH must be between 4 and 10");
        }
        if self.otp.max_attempts < 1 {
            bail!("OTP_MAX_ATTEMPTS must be at least 1");
        }
        if self.session.max_per_user < 1 {
            bail!("SESSION_MAX_PER_USER must be at least 1");
        }
        if self.jwt.audience.is_empty() {
            bail!("JWT_AUDIENCE must contain at least one audience");
        }
        if self.jwt.access_ttl >= self.jwt.refresh_ttl {
            bail!("JWT_ACCESS_TOKEN_TTL must be shorter than JWT_REFRESH_TOKEN_TTL");
        }
        Ok(())
    }
}

pub fn parse_same_site(raw: &str) -> anyhow::Result<SameSite> {
    match raw.to_ascii_lowercase().as_str() {
        "lax" => Ok(SameSite::Lax),
        "strict" => Ok(SameSite::Strict),
        "none" => Ok(SameSite::None),
        other => Err(anyhow::anyhow!("'{other}' is not a SameSite value (lax|strict|none)")),
    }
    .context("COOKIE_SAME_SITE")
}
