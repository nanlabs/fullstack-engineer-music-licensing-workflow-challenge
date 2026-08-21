//! Environment-driven configuration.
//!
//! Every value is read once at startup and validated eagerly, so a
//! misconfigured process fails before it accepts traffic rather than on the
//! first request that happens to need the value.

use std::env::VarError;
use std::fmt;
use std::net::SocketAddr;
use std::time::Duration;

/// Minimum accepted `JWT_SECRET` length, in bytes.
const MIN_JWT_SECRET_BYTES: usize = 32;

const DEFAULT_JWT_ISSUER: &str = "music-licensing-api";
const DEFAULT_JWT_AUDIENCE: &str = "music-licensing-clients";

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{name} is required but not set")]
    Missing { name: &'static str },
    #[error("{name} is not valid UTF-8")]
    NotUnicode { name: &'static str },
    #[error("{name} has an invalid value: {reason}")]
    Invalid { name: &'static str, reason: String },
}

/// A configuration value that must never reach logs or error output.
#[derive(Clone)]
pub struct Secret(String);

impl Secret {
    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Builds a secret directly, for tests that construct a `Config` by hand
    /// rather than through the environment.
    #[cfg(test)]
    pub fn for_test(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret(redacted)")
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_address: SocketAddr,
    pub database_url: Secret,
    pub database_max_connections: u32,
    pub database_acquire_timeout: Duration,
    pub jwt_secret: Secret,
    /// Expected `iss` claim, and the issuer stamped on development tokens.
    pub jwt_issuer: String,
    /// Expected `aud` claim, and the audience stamped on development tokens.
    pub jwt_audience: String,
    pub jwt_token_ttl: Duration,
    pub dev_token_endpoint_enabled: bool,
    pub cors_allowed_origins: Vec<String>,
    pub sse_max_connections: usize,
}

impl Config {
    /// Reads and validates the full configuration from the process environment.
    ///
    /// Values that later phases consume (the JWT secret, the dev-token switch,
    /// the SSE connection cap) are validated here too: catching a bad secret at
    /// startup is the whole point of eager configuration.
    pub fn from_env() -> Result<Self, ConfigError> {
        let bind_address = optional("HTTP_BIND_ADDRESS")?
            .map(|value| parse_bind_address("HTTP_BIND_ADDRESS", &value))
            .transpose()?
            .unwrap_or_else(|| SocketAddr::from(([0, 0, 0, 0], 8080)));

        let database_url = Secret(required("DATABASE_URL")?);

        let database_max_connections = optional_parsed("DATABASE_MAX_CONNECTIONS")?.unwrap_or(10);
        if database_max_connections == 0 {
            return Err(ConfigError::Invalid {
                name: "DATABASE_MAX_CONNECTIONS",
                reason: "must be at least 1".to_string(),
            });
        }

        let database_acquire_timeout = optional("DATABASE_ACQUIRE_TIMEOUT")?
            .map(|value| parse_duration("DATABASE_ACQUIRE_TIMEOUT", &value))
            .transpose()?
            .unwrap_or_else(|| Duration::from_secs(2));

        let jwt_secret = required("JWT_SECRET")?;
        if jwt_secret.len() < MIN_JWT_SECRET_BYTES {
            return Err(ConfigError::Invalid {
                name: "JWT_SECRET",
                reason: format!("must be at least {MIN_JWT_SECRET_BYTES} bytes"),
            });
        }

        // Issuer and audience have defaults because they are contract labels,
        // not secrets; a deployment fronted by a real identity provider
        // overrides them to match the tokens that provider issues.
        let jwt_issuer = optional("JWT_ISSUER")?.unwrap_or_else(|| DEFAULT_JWT_ISSUER.to_string());
        let jwt_audience =
            optional("JWT_AUDIENCE")?.unwrap_or_else(|| DEFAULT_JWT_AUDIENCE.to_string());

        let jwt_token_ttl = optional("JWT_TOKEN_TTL")?
            .map(|value| parse_duration("JWT_TOKEN_TTL", &value))
            .transpose()?
            .unwrap_or_else(|| Duration::from_secs(3600));

        let dev_token_endpoint_enabled = optional("DEV_TOKEN_ENDPOINT_ENABLED")?
            .map(|value| parse_bool("DEV_TOKEN_ENDPOINT_ENABLED", &value))
            .transpose()?
            .unwrap_or(false);

        let cors_allowed_origins = optional("CORS_ALLOWED_ORIGINS")?
            .map(|value| parse_origins("CORS_ALLOWED_ORIGINS", &value))
            .transpose()?
            .unwrap_or_default();

        let sse_max_connections = optional_parsed("SSE_MAX_CONNECTIONS")?.unwrap_or(1000);
        if sse_max_connections == 0 {
            return Err(ConfigError::Invalid {
                name: "SSE_MAX_CONNECTIONS",
                reason: "must be at least 1".to_string(),
            });
        }

        Ok(Self {
            bind_address,
            database_url,
            database_max_connections,
            database_acquire_timeout,
            jwt_secret: Secret(jwt_secret),
            jwt_issuer,
            jwt_audience,
            jwt_token_ttl,
            dev_token_endpoint_enabled,
            cors_allowed_origins,
            sse_max_connections,
        })
    }
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    match optional(name)? {
        Some(value) => Ok(value),
        None => Err(ConfigError::Missing { name }),
    }
}

/// Reads a variable, treating an empty or whitespace-only value as unset so
/// that a blank entry in an `.env` file falls back to the default rather than
/// failing an unrelated parse.
fn optional(name: &'static str) -> Result<Option<String>, ConfigError> {
    match std::env::var(name) {
        Ok(value) => {
            let trimmed = value.trim();
            Ok(if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            })
        }
        Err(VarError::NotPresent) => Ok(None),
        Err(VarError::NotUnicode(_)) => Err(ConfigError::NotUnicode { name }),
    }
}

fn optional_parsed<T>(name: &'static str) -> Result<Option<T>, ConfigError>
where
    T: std::str::FromStr,
    T::Err: fmt::Display,
{
    optional(name)?
        .map(|value| {
            value.parse::<T>().map_err(|error| ConfigError::Invalid {
                name,
                reason: error.to_string(),
            })
        })
        .transpose()
}

fn parse_bind_address(name: &'static str, value: &str) -> Result<SocketAddr, ConfigError> {
    value.parse().map_err(|_| ConfigError::Invalid {
        name,
        reason: format!("`{value}` is not a host:port address"),
    })
}

fn parse_bool(name: &'static str, value: &str) -> Result<bool, ConfigError> {
    match value.to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => Ok(true),
        "false" | "0" | "no" | "off" => Ok(false),
        other => Err(ConfigError::Invalid {
            name,
            reason: format!("`{other}` is not a boolean"),
        }),
    }
}

/// Accepts a bare number of seconds or a `ms`/`s`/`m` suffixed value.
fn parse_duration(name: &'static str, value: &str) -> Result<Duration, ConfigError> {
    let invalid = |reason: String| ConfigError::Invalid { name, reason };

    let (digits, multiplier_ms) = if let Some(rest) = value.strip_suffix("ms") {
        (rest, 1)
    } else if let Some(rest) = value.strip_suffix('s') {
        (rest, 1_000)
    } else if let Some(rest) = value.strip_suffix('m') {
        (rest, 60_000)
    } else {
        (value, 1_000)
    };

    let amount: u64 = digits.trim().parse().map_err(|_| {
        invalid(format!(
            "`{value}` is not a duration such as `2s` or `500ms`"
        ))
    })?;

    let millis = amount
        .checked_mul(multiplier_ms)
        .ok_or_else(|| invalid(format!("`{value}` overflows")))?;

    if millis == 0 {
        return Err(invalid("must be greater than zero".to_string()));
    }

    Ok(Duration::from_millis(millis))
}

/// Parses a comma-separated CORS allowlist.
///
/// `*` is rejected outright: the plan requires an explicit allowlist, and a
/// wildcard that works locally has a habit of surviving into a deployment.
fn parse_origins(name: &'static str, value: &str) -> Result<Vec<String>, ConfigError> {
    let mut origins = Vec::new();

    for origin in value.split(',') {
        let origin = origin.trim();
        if origin.is_empty() {
            continue;
        }
        if origin == "*" {
            return Err(ConfigError::Invalid {
                name,
                reason: "wildcard origins are not allowed; list origins explicitly".to_string(),
            });
        }
        origins.push(origin.to_string());
    }

    Ok(origins)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_durations_with_and_without_units() {
        assert_eq!(
            parse_duration("T", "2s").unwrap(),
            Duration::from_millis(2_000)
        );
        assert_eq!(
            parse_duration("T", "500ms").unwrap(),
            Duration::from_millis(500)
        );
        assert_eq!(
            parse_duration("T", "1m").unwrap(),
            Duration::from_millis(60_000)
        );
        assert_eq!(
            parse_duration("T", "3").unwrap(),
            Duration::from_millis(3_000)
        );
    }

    #[test]
    fn rejects_zero_and_malformed_durations() {
        assert!(parse_duration("T", "0s").is_err());
        assert!(parse_duration("T", "soon").is_err());
        assert!(parse_duration("T", "-1s").is_err());
    }

    #[test]
    fn parses_boolean_spellings() {
        for truthy in ["true", "TRUE", "1", "yes", "on"] {
            assert!(parse_bool("T", truthy).unwrap());
        }
        for falsy in ["false", "0", "no", "off"] {
            assert!(!parse_bool("T", falsy).unwrap());
        }
        assert!(parse_bool("T", "maybe").is_err());
    }

    #[test]
    fn parses_origin_allowlist_and_rejects_wildcard() {
        let origins = parse_origins("T", "http://localhost:3000, https://example.test ,").unwrap();
        assert_eq!(origins, ["http://localhost:3000", "https://example.test"]);

        assert!(parse_origins("T", "*").is_err());
        assert!(parse_origins("T", "http://localhost:3000,*").is_err());
        assert!(parse_origins("T", "").unwrap().is_empty());
    }

    #[test]
    fn secret_debug_output_is_redacted() {
        let secret = Secret("super-secret-value".to_string());
        assert_eq!(format!("{secret:?}"), "Secret(redacted)");
        assert!(!format!("{secret:?}").contains("super-secret-value"));
        assert_eq!(secret.expose(), "super-secret-value");
    }
}
