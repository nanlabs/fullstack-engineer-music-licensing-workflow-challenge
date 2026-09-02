use std::sync::Arc;

use actix_web::web;
use sqlx::PgPool;

use super::auth::adapters::{JwtTokenService, PostgresSessionRepository, PostgresTokenRepository};
use super::auth::{AuthConfig, AuthService, TokenService};
use super::role::RoleService;
use super::role::adapters::PostgresRoleRepository;
use super::user::UserService;
use super::user::adapters::{BcryptPasswordService, PostgresUserRepository};
use super::user::{PasswordService, UserRepository};

#[derive(Clone)]
pub struct IamContainer {
    pub auth_svc: web::Data<AuthService>,
    pub user_svc: web::Data<UserService>,
    pub role_svc: web::Data<RoleService>,
    pub token_svc: web::Data<dyn TokenService>,
    pub user_repo: Arc<dyn UserRepository>,
    pub password_svc: Arc<dyn PasswordService>,
}

impl IamContainer {
    pub fn new(pool: PgPool, auth_config: AuthConfig) -> Self {
        let user_repo: Arc<dyn UserRepository> =
            Arc::new(PostgresUserRepository::new(pool.clone()));
        let role_repo = Arc::new(PostgresRoleRepository::new(pool.clone()));
        let password_svc: Arc<dyn PasswordService> = Arc::new(BcryptPasswordService::new());
        let token_svc: Arc<dyn TokenService> = Arc::new(JwtTokenService::new(&auth_config.jwt));
        let token_repo = Arc::new(PostgresTokenRepository::new(pool.clone()));
        let session_repo = Arc::new(PostgresSessionRepository::new(pool));

        let auth_svc = web::Data::new(AuthService::new(
            user_repo.clone(),
            password_svc.clone(),
            token_svc.clone(),
            token_repo,
            session_repo,
            role_repo.clone(),
            auth_config,
        ));

        let token_svc_data = web::Data::from(token_svc);
        let user_svc = web::Data::new(UserService::new(user_repo.clone(), password_svc.clone()));
        let role_svc = web::Data::new(RoleService::new(role_repo, user_repo.clone()));

        Self {
            auth_svc,
            user_svc,
            role_svc,
            token_svc: token_svc_data,
            user_repo,
            password_svc,
        }
    }

    pub fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.auth_svc.clone())
            .app_data(self.token_svc.clone())
            .app_data(self.user_svc.clone())
            .app_data(self.role_svc.clone())
            .configure(super::auth::api::configure);
    }
}
