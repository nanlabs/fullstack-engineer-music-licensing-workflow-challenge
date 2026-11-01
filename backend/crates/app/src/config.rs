//! Environment-driven configuration. Every value has a development default
//! except the ones that must never be guessed (database URL, JWT secret).

use std::fmt;
use std::str::FromStr;
use std::time::Duration;

use anyhow::{anyhow, Context};
use iam::config::{parse_same_site, CookieConfig, InvitationConfig, JwtConfig, OtpConfig, SessionConfig};
use iam::IamConfig;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub telemetry: TelemetryConfig,
    pub iam: IamConfig,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Development,
    Test,
    Production,
}

impl Environment {
    pub fn is_development(self) -> bool {
        self == Environment::Development
    }
}

impl FromStr for Environment {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "development" | "dev" | "local" => Ok(Environment::Development),
            "test" => Ok(Environment::Test),
            "production" | "prod" => Ok(Environment::Production),
            other => Err(anyhow!("unknown environment '{other}' (development|test|production)")),
        }
    }
}

impl fmt::Display for Environment {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Environment::Development => "development",
            Environment::Test => "test",
            Environment::Production => "production",
        };
        f.write_str(s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    Pretty,
    Json,
}

impl FromStr for LogFormat {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "pretty" | "text" => Ok(LogFormat::Pretty),
            "json" => Ok(LogFormat::Json),
            other => Err(anyhow!("unknown log format '{other}' (pretty|json)")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub env: Environment,
    pub cors_origins: Vec<String>,
    pub log_format: LogFormat,
    pub shutdown_timeout: Duration,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub acquire_timeout: Duration,
}

#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    pub service_name: String,
    pub service_version: String,
    /// OTLP gRPC endpoint (for example `http://datadog-agent:4317`). When
    /// unset, traces and logs stay on stdout.
    pub otlp_endpoint: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let env: Environment = env_or("APP_ENV", "development")?;
        let default_log_format = if env.is_development() { "pretty" } else { "json" };

        Ok(Self {
            server: ServerConfig {
                host: env_or("HOST", "0.0.0.0")?,
                port: env_or("PORT", "8080")?,
                env,
                cors_origins: env_list("CORS_ORIGINS", "http://localhost:5173"),
                log_format: env_or("LOG_FORMAT", default_log_format)?,
                shutdown_timeout: env_duration("SHUTDOWN_TIMEOUT", "30s")?,
            },
            database: DatabaseConfig {
                url: env_required("DATABASE_URL")?,
                max_connections: env_or("DATABASE_MAX_CONNECTIONS", "10")?,
                acquire_timeout: env_duration("DATABASE_ACQUIRE_TIMEOUT", "5s")?,
            },
            telemetry: TelemetryConfig {
                service_name: env_or("SERVICE_NAME", "music-licensing-backend")?,
                service_version: env!("CARGO_PKG_VERSION").to_string(),
                otlp_endpoint: env_optional("OTEL_EXPORTER_OTLP_ENDPOINT"),
            },
            iam: load_iam_config(env)?,
        })
    }
}

fn load_iam_config(env: Environment) -> anyhow::Result<IamConfig> {
    let config = IamConfig {
        jwt: JwtConfig {
            secret: env_required("JWT_SECRET")?,
            issuer: env_or("JWT_ISSUER", "music-licensing")?,
            audience: env_list("JWT_AUDIENCE", "music-licensing-api"),
            access_ttl: env_duration("JWT_ACCESS_TOKEN_TTL", "15m")?,
            refresh_ttl: env_duration("JWT_REFRESH_TOKEN_TTL", "7d")?,
        },
        otp: OtpConfig {
            code_length: env_or("OTP_CODE_LENGTH", "6")?,
            ttl: env_duration("OTP_EXPIRATION_TIME", "10m")?,
            max_attempts: env_or("OTP_MAX_ATTEMPTS", "5")?,
            rate_limit_window: env_duration("OTP_RATE_LIMIT_WINDOW", "1m")?,
        },
        session: SessionConfig {
            max_per_user: env_or("SESSION_MAX_PER_USER", "10")?,
            cleanup_interval: env_duration("SESSION_CLEANUP_INTERVAL", "1h")?,
        },
        invitation: InvitationConfig {
            ttl: env_duration("INVITATION_TTL", "7d")?,
        },
        cookie: CookieConfig {
            access_token_name: env_or("COOKIE_ACCESS_TOKEN_NAME", "access_token")?,
            refresh_token_name: env_or("COOKIE_REFRESH_TOKEN_NAME", "refresh_token")?,
            secure: env_or("COOKIE_SECURE", if env.is_development() { "false" } else { "true" })?,
            http_only: env_or("COOKIE_HTTP_ONLY", "true")?,
            same_site: parse_same_site(&env_or::<String>("COOKIE_SAME_SITE", "lax")?)?,
            domain: env_optional("COOKIE_DOMAIN"),
            path: env_or("COOKIE_PATH", "/")?,
        },
    };
    config.validate()?;
    Ok(config)
}

pub fn env_optional(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

pub fn env_required(key: &str) -> anyhow::Result<String> {
    env_optional(key).ok_or_else(|| anyhow!("{key} is required"))
}

pub fn env_or<T>(key: &str, default: &str) -> anyhow::Result<T>
where
    T: FromStr,
    T::Err: fmt::Display,
{
    let raw = env_optional(key).unwrap_or_else(|| default.to_string());
    raw.parse::<T>().map_err(|e| anyhow!("{key}='{raw}' is invalid: {e}"))
}

pub fn env_duration(key: &str, default: &str) -> anyhow::Result<Duration> {
    let raw = env_optional(key).unwrap_or_else(|| default.to_string());
    humantime::parse_duration(&raw).with_context(|| format!("{key}='{raw}' is not a duration (e.g. 10m, 2h)"))
}

pub fn env_list(key: &str, default: &str) -> Vec<String> {
    env_optional(key)
        .unwrap_or_else(|| default.to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}
