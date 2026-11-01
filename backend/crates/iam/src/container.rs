//! IAM composition. Receives shared infrastructure through [`Deps`] and
//! builds repositories, services and route registration with plain
//! constructors. Nothing is discovered by reflection or hidden in context.

use std::sync::Arc;

use actix_web::middleware::from_fn;
use actix_web::web;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;

use crate::auth::api::handlers as auth_h;
use crate::auth::jwt::JwtService;
use crate::auth::middleware;
use crate::auth::onboarding::{InvitationAcceptor, PostgresOnboarding};
use crate::auth::service::{PasswordlessDeps, PasswordlessService};
use crate::auth::session::infra::postgres::{PostgresRefreshTokenRepository, PostgresSessionRepository};
use crate::auth::session::port::{RefreshTokenRepository, SessionRepository};
use crate::config::IamConfig;
use crate::invitation::api::handlers as invitation_h;
use crate::invitation::infra::postgres::PostgresInvitationRepository;
use crate::invitation::port::{InvitationNotifier, InvitationRepository};
use crate::invitation::service::InvitationService;
use crate::otp::infra::postgres::PostgresOtpRepository;
use crate::otp::port::{OtpNotifier, OtpRepository};
use crate::otp::service::OtpService;
use crate::role::api::handlers as role_h;
use crate::role::infra::postgres::PostgresRoleRepository;
use crate::role::port::RoleRepository;
use crate::role::service::RoleService;
use crate::tenant::api::handlers as tenant_h;
use crate::tenant::infra::postgres::PostgresTenantRepository;
use crate::tenant::port::TenantRepository;
use crate::tenant::service::TenantService;
use crate::user::api::handlers as user_h;
use crate::user::infra::postgres::PostgresUserRepository;
use crate::user::port::UserRepository;
use crate::user::service::UserService;

pub struct Deps {
    pub pool: PgPool,
    pub config: IamConfig,
    pub otp_notifier: Arc<dyn OtpNotifier>,
    pub invitation_notifier: Arc<dyn InvitationNotifier>,
}

#[derive(Clone)]
pub struct Container {
    pub config: Arc<IamConfig>,
    // Repositories (ports)
    pub tenants: Arc<dyn TenantRepository>,
    pub users: Arc<dyn UserRepository>,
    pub roles: Arc<dyn RoleRepository>,
    pub otps: Arc<dyn OtpRepository>,
    pub invitations: Arc<dyn InvitationRepository>,
    pub sessions: Arc<dyn SessionRepository>,
    pub refresh_tokens: Arc<dyn RefreshTokenRepository>,
    // Services (use cases)
    pub jwt: Arc<JwtService>,
    pub tenant_service: Arc<TenantService>,
    pub user_service: Arc<UserService>,
    pub role_service: Arc<RoleService>,
    pub otp_service: Arc<OtpService>,
    pub invitation_service: Arc<InvitationService>,
    pub auth_service: Arc<PasswordlessService>,
}

impl Container {
    pub fn new(deps: Deps) -> Self {
        let config = Arc::new(deps.config);
        let pool = deps.pool;

        let tenants: Arc<dyn TenantRepository> = Arc::new(PostgresTenantRepository::new(pool.clone()));
        let users: Arc<dyn UserRepository> = Arc::new(PostgresUserRepository::new(pool.clone()));
        let roles: Arc<dyn RoleRepository> = Arc::new(PostgresRoleRepository::new(pool.clone()));
        let otps: Arc<dyn OtpRepository> = Arc::new(PostgresOtpRepository::new(pool.clone()));
        let invitations: Arc<dyn InvitationRepository> = Arc::new(PostgresInvitationRepository::new(pool.clone()));
        let sessions: Arc<dyn SessionRepository> = Arc::new(PostgresSessionRepository::new(pool.clone()));
        let refresh_tokens: Arc<dyn RefreshTokenRepository> =
            Arc::new(PostgresRefreshTokenRepository::new(pool.clone()));
        let onboarding: Arc<dyn InvitationAcceptor> = Arc::new(PostgresOnboarding::new(pool));

        let jwt = Arc::new(JwtService::new(&config.jwt));
        let tenant_service = Arc::new(TenantService::new(tenants.clone()));
        let user_service = Arc::new(UserService::new(users.clone()));
        let role_service = Arc::new(RoleService::new(roles.clone(), users.clone()));
        let otp_service = Arc::new(OtpService::new(otps.clone(), deps.otp_notifier, config.otp.clone()));
        let invitation_service = Arc::new(InvitationService::new(
            invitations.clone(),
            users.clone(),
            roles.clone(),
            tenants.clone(),
            deps.invitation_notifier,
            config.invitation.clone(),
        ));
        let auth_service = Arc::new(PasswordlessService::new(PasswordlessDeps {
            users: users.clone(),
            tenants: tenants.clone(),
            roles: roles.clone(),
            invitations: invitation_service.clone(),
            otp: otp_service.clone(),
            sessions: sessions.clone(),
            refresh_tokens: refresh_tokens.clone(),
            jwt: jwt.clone(),
            onboarding,
            config: config.clone(),
        }));

        Self {
            config,
            tenants,
            users,
            roles,
            otps,
            invitations,
            sessions,
            refresh_tokens,
            jwt,
            tenant_service,
            user_service,
            role_service,
            otp_service,
            invitation_service,
            auth_service,
        }
    }

    /// Registers IAM routes. Call inside the `/api/v1` scope.
    ///
    /// Middleware is attached to concrete prefixes rather than a catch-all
    /// scope so that unknown paths still produce a 404 instead of a 401.
    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(web::Data::new(self.clone()));

        // Public authentication flows plus identity-only session routes.
        cfg.service(
            web::scope("/auth")
                .service(
                    web::scope("/passwordless")
                        .route("/tenants", web::post().to(auth_h::memberships))
                        .route("/signup/initiate", web::post().to(auth_h::initiate_signup))
                        .route("/signup/verify", web::post().to(auth_h::verify_signup))
                        .route("/login/initiate", web::post().to(auth_h::initiate_login))
                        .route("/login/verify", web::post().to(auth_h::verify_login))
                        .route("/resend-otp", web::post().to(auth_h::resend_otp)),
                )
                .route("/refresh", web::post().to(auth_h::refresh))
                .service(
                    web::scope("/logout")
                        .wrap(from_fn(middleware::authenticate_user_jwt))
                        .route("", web::post().to(auth_h::logout))
                        .route("/all", web::post().to(auth_h::logout_all)),
                )
                .service(
                    web::resource("/me")
                        .wrap(from_fn(middleware::authenticate_user_jwt))
                        .route(web::get().to(auth_h::me)),
                )
                .service(
                    web::resource("/sessions")
                        .wrap(from_fn(middleware::authenticate_user_jwt))
                        .route(web::get().to(auth_h::sessions)),
                ),
        );

        // Tenant-scoped management. Scope checks happen inside the services.
        cfg.service(
            web::resource("/scopes")
                .wrap(from_fn(middleware::authenticate))
                .route(web::get().to(tenant_h::list_scopes)),
        );
        cfg.service(
            web::scope("/tenants")
                .wrap(from_fn(middleware::authenticate))
                .route("/me", web::get().to(tenant_h::get_my_tenant)),
        );
        cfg.service(
            web::scope("/users")
                .wrap(from_fn(middleware::authenticate))
                .route("", web::get().to(user_h::list_users))
                .route("/{id}", web::get().to(user_h::get_user))
                .route("/{id}/suspend", web::post().to(user_h::suspend_user))
                .route("/{id}/reinstate", web::post().to(user_h::reinstate_user))
                .route("/{id}/scopes", web::put().to(user_h::set_user_scopes))
                .route("/{id}/roles", web::get().to(user_h::get_user_roles)),
        );
        cfg.service(
            web::scope("/roles")
                .wrap(from_fn(middleware::authenticate))
                .route("", web::get().to(role_h::list_roles))
                .route("", web::post().to(role_h::create_role))
                .route("/{id}", web::get().to(role_h::get_role))
                .route("/{id}", web::put().to(role_h::update_role))
                .route("/{id}", web::delete().to(role_h::delete_role))
                .route("/{id}/users", web::post().to(role_h::assign_role))
                .route("/{id}/users/{user_id}", web::delete().to(role_h::unassign_role)),
        );
        cfg.service(
            web::scope("/invitations")
                .wrap(from_fn(middleware::authenticate))
                .route("", web::get().to(invitation_h::list_invitations))
                .route("", web::post().to(invitation_h::create_invitation))
                .route("/{id}", web::get().to(invitation_h::get_invitation))
                .route("/{id}/resend", web::post().to(invitation_h::resend_invitation))
                .route("/{id}/revoke", web::post().to(invitation_h::revoke_invitation)),
        );
    }

    /// Periodic cleanup of expired OTPs, sessions and refresh tokens.
    pub fn spawn_background(&self, cancel: CancellationToken) {
        let interval = self.config.session.cleanup_interval;
        let otps = self.otps.clone();
        let sessions = self.sessions.clone();
        let refresh_tokens = self.refresh_tokens.clone();

        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            ticker.tick().await; // the first tick completes immediately
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => break,
                    _ = ticker.tick() => {
                        let otps = otps.delete_expired().await.unwrap_or_else(|e| { tracing::warn!(error = %e, "otp cleanup failed"); 0 });
                        let tokens = refresh_tokens.delete_expired().await.unwrap_or_else(|e| { tracing::warn!(error = %e, "refresh token cleanup failed"); 0 });
                        let sessions = sessions.delete_expired().await.unwrap_or_else(|e| { tracing::warn!(error = %e, "session cleanup failed"); 0 });
                        tracing::info!(otps, refresh_tokens = tokens, sessions, "expired credentials cleaned up");
                    }
                }
            }
            tracing::info!("iam cleanup task stopped");
        });
    }
}
