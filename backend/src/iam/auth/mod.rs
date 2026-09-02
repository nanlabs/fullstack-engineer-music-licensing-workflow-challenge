pub mod adapters;
pub mod api;
mod config;
mod error;
mod middleware;
pub mod model;
mod port;
mod service;

pub use config::{AuthConfig, JWTConfig, OAuthConfig, OAuthConfigs};
pub use error::AuthError;
pub use middleware::{AuthContext, RequireScope};
pub use model::{
    LoginMetadata, LoginRequest, OAuthUserInfo, RefreshToken, TokenClaims, TokenPair, UserSession,
};
pub use port::{OAuthService, SessionRepository, TokenRepository, TokenService};
pub use service::AuthService;
