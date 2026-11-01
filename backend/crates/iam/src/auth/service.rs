use std::sync::Arc;

use chrono::{Duration as ChronoDuration, Utc};
use errx::AppError;
use kernel::{AuthContext, SessionId, TenantId};
use uuid::Uuid;
use validator::Validate;

use super::jwt::JwtService;
use super::onboarding::{Candidate, InvitationAcceptor};
use super::session::port::{RefreshTokenRepository, SessionRepository};
use super::session::{generate_refresh_token, hash_refresh_token, RefreshToken, Session, SessionResponse};
use super::{
    AuthError, AuthMethods, ClientInfo, InitiateLoginRequest, InitiateLoginResponse, InitiateSignupRequest,
    InitiateSignupResponse, MeResponse, MembershipOption, MembershipsRequest, MembershipsResponse, RefreshResponse,
    ResendOtpRequest, ResendOtpResponse, SessionsResponse, TokenResponse, VerifyLoginRequest, VerifySignupRequest,
    VerifySignupResponse,
};
use crate::config::IamConfig;
use crate::invitation::service::InvitationService;
use crate::otp::service::OtpService;
use crate::otp::OtpPurpose;
use crate::role::port::RoleRepository;
use crate::tenant::port::TenantRepository;
use crate::tenant::{Tenant, TenantError, TenantResponse};
use crate::user::port::UserRepository;
use crate::user::{User, UserResponse};

pub struct PasswordlessService {
    users: Arc<dyn UserRepository>,
    tenants: Arc<dyn TenantRepository>,
    roles: Arc<dyn RoleRepository>,
    invitations: Arc<InvitationService>,
    otp: Arc<OtpService>,
    sessions: Arc<dyn SessionRepository>,
    refresh_tokens: Arc<dyn RefreshTokenRepository>,
    jwt: Arc<JwtService>,
    onboarding: Arc<dyn InvitationAcceptor>,
    config: Arc<IamConfig>,
}

pub struct PasswordlessDeps {
    pub users: Arc<dyn UserRepository>,
    pub tenants: Arc<dyn TenantRepository>,
    pub roles: Arc<dyn RoleRepository>,
    pub invitations: Arc<InvitationService>,
    pub otp: Arc<OtpService>,
    pub sessions: Arc<dyn SessionRepository>,
    pub refresh_tokens: Arc<dyn RefreshTokenRepository>,
    pub jwt: Arc<JwtService>,
    pub onboarding: Arc<dyn InvitationAcceptor>,
    pub config: Arc<IamConfig>,
}

impl PasswordlessService {
    pub fn new(deps: PasswordlessDeps) -> Self {
        Self {
            users: deps.users,
            tenants: deps.tenants,
            roles: deps.roles,
            invitations: deps.invitations,
            otp: deps.otp,
            sessions: deps.sessions,
            refresh_tokens: deps.refresh_tokens,
            jwt: deps.jwt,
            onboarding: deps.onboarding,
            config: deps.config,
        }
    }

    // ---------------------------------------------------------------------
    // Discovery
    // ---------------------------------------------------------------------

    /// Tenants where the email is a member. Empty when none, so the response
    /// shape does not change for unknown addresses.
    pub async fn memberships(&self, req: MembershipsRequest) -> Result<MembershipsResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);
        let mut tenants = Vec::new();
        for user in self.users.find_by_email_across_tenants(&email).await? {
            let Some(tenant) = self.tenants.get_by_id(user.tenant_id).await? else {
                continue;
            };
            if !tenant.is_active() {
                continue;
            }
            tenants.push(MembershipOption {
                tenant_id: tenant.id,
                tenant_slug: tenant.slug,
                tenant_name: tenant.name,
                user_status: user.status,
                auth_methods: AuthMethods { otp: user.otp_enabled },
            });
        }
        Ok(MembershipsResponse {
            count: tenants.len(),
            email,
            tenants,
        })
    }

    // ---------------------------------------------------------------------
    // Signup (invitation + OTP)
    // ---------------------------------------------------------------------

    /// Validates the invitation and sends proof-of-email only. Nothing about
    /// membership changes until verification.
    pub async fn initiate_signup(&self, req: InitiateSignupRequest) -> Result<InitiateSignupResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);
        let invitation = self
            .invitations
            .validate_for_signup(&req.invitation_token, &email, None)
            .await?;
        let otp = self.otp.generate(&email, OtpPurpose::Signup).await?;
        Ok(InitiateSignupResponse {
            message: "Verify your email to accept the invitation.",
            email,
            tenant_id: invitation.tenant_id,
            requires_otp: true,
            expires_in_seconds: otp.seconds_until_expiry(Utc::now()),
        })
    }

    /// Completes onboarding once mailbox ownership is proven. The user then
    /// logs in separately with a `login` code.
    pub async fn verify_signup(&self, req: VerifySignupRequest) -> Result<VerifySignupResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);
        self.invitations
            .validate_for_signup(&req.invitation_token, &email, Some(req.tenant_id))
            .await?;
        let candidate = Candidate {
            email: email.clone(),
            name: req.name,
            tenant_id: req.tenant_id,
        };
        let (user, tenant) = self
            .onboarding
            .accept(&req.invitation_token, candidate, &req.code)
            .await?;
        tracing::info!(user_id = %user.id, tenant_id = %tenant.id, "account linked via otp signup");
        Ok(VerifySignupResponse {
            message: "Email verified. You can now log in.",
            tenant_id: tenant.id,
            email: user.email,
            user_id: user.id,
        })
    }

    // ---------------------------------------------------------------------
    // Login (OTP)
    // ---------------------------------------------------------------------

    pub async fn initiate_login(&self, req: InitiateLoginRequest) -> Result<InitiateLoginResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);
        let generic = InitiateLoginResponse {
            message: "If this email is registered, you will receive a login code.",
            email: email.clone(),
            expires_in_seconds: self.config.otp.ttl.as_secs() as i64,
        };

        // Do not reveal whether the email is a member.
        let Some(user) = self.users.get_by_email(req.tenant_id, &email).await? else {
            return Ok(generic);
        };
        if !user.is_active() {
            return Err(AuthError::AccountNotActive);
        }
        if !user.otp_enabled {
            return Err(AuthError::OtpNotEnabled);
        }
        if !user.email_verified {
            return Err(AuthError::EmailNotVerified);
        }
        self.load_active_tenant(user.tenant_id).await?;

        let otp = self.otp.generate(&email, OtpPurpose::Login).await?;
        Ok(InitiateLoginResponse {
            message: "Login code sent to your email.",
            email,
            expires_in_seconds: otp.seconds_until_expiry(Utc::now()),
        })
    }

    pub async fn verify_login(&self, req: VerifyLoginRequest, client: ClientInfo) -> Result<TokenResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);

        self.otp.verify(&email, &req.code, OtpPurpose::Login).await?;

        let user = self
            .users
            .get_by_email(req.tenant_id, &email)
            .await?
            .ok_or(AuthError::Unauthorized)?;
        if !user.can_login_with_otp() {
            return Err(AuthError::AccountNotActive);
        }
        let tenant = self.load_active_tenant(user.tenant_id).await?;

        let response = self.issue_session(&user, &tenant, &client).await?;
        self.users.record_login(user.id).await?;
        tracing::info!(user_id = %user.id, tenant_id = %tenant.id, ip = %client.ip_address, method = "otp", "login succeeded");
        Ok(response)
    }

    pub async fn resend_otp(&self, req: ResendOtpRequest) -> Result<ResendOtpResponse, AuthError> {
        req.validate().map_err(AppError::from)?;
        let email = normalize_email(&req.email);

        match req.purpose {
            OtpPurpose::Signup => {
                let token = req
                    .invitation_token
                    .as_deref()
                    .ok_or_else(|| AppError::validation("invitation_token is required for signup codes"))?;
                self.invitations
                    .validate_for_signup(token, &email, Some(req.tenant_id))
                    .await?;
                let otp = self.otp.generate(&email, OtpPurpose::Signup).await?;
                Ok(ResendOtpResponse {
                    message: "Verification code sent.",
                    expires_in_seconds: otp.seconds_until_expiry(Utc::now()),
                })
            }
            OtpPurpose::Login => {
                let generic = ResendOtpResponse {
                    message: "If this email is registered, a login code has been sent.",
                    expires_in_seconds: self.config.otp.ttl.as_secs() as i64,
                };
                let Some(user) = self.users.get_by_email(req.tenant_id, &email).await? else {
                    return Ok(generic);
                };
                if !user.can_login_with_otp() {
                    return Err(AuthError::AccountNotActive);
                }
                self.load_active_tenant(user.tenant_id).await?;
                let otp = self.otp.generate(&email, OtpPurpose::Login).await?;
                Ok(ResendOtpResponse {
                    message: "Login code sent.",
                    expires_in_seconds: otp.seconds_until_expiry(Utc::now()),
                })
            }
        }
    }

    // ---------------------------------------------------------------------
    // Sessions and tokens
    // ---------------------------------------------------------------------

    /// Refresh token rotation. Presenting an already-revoked token means it
    /// leaked: the whole session is revoked.
    pub async fn refresh(&self, raw_refresh_token: &str, client: &ClientInfo) -> Result<RefreshResponse, AuthError> {
        let hash = hash_refresh_token(raw_refresh_token);
        let now = Utc::now();
        let token = self
            .refresh_tokens
            .get_by_hash(&hash)
            .await?
            .ok_or(AuthError::InvalidRefreshToken)?;

        if token.is_revoked() {
            tracing::warn!(session_id = %token.session_id, user_id = %token.user_id, ip = %client.ip_address, "revoked refresh token reused; revoking session");
            self.refresh_tokens.revoke_by_session(token.session_id).await?;
            self.sessions.revoke(token.session_id).await?;
            return Err(AuthError::InvalidRefreshToken);
        }
        if token.is_expired(now) {
            return Err(AuthError::InvalidRefreshToken);
        }

        let session = self.sessions.get(token.session_id).await?;
        let session = match session {
            Some(s) if s.is_active(now) && s.user_id == token.user_id && s.tenant_id == token.tenant_id => s,
            _ => {
                self.refresh_tokens.revoke_by_hash(&hash).await?;
                return Err(AuthError::SessionExpired);
            }
        };

        let user = self
            .users
            .get_by_id(token.tenant_id, token.user_id)
            .await?
            .ok_or(AuthError::InvalidRefreshToken)?;
        if !user.can_login() || user.credential_version != token.credential_version {
            return Err(AuthError::InvalidRefreshToken);
        }
        let tenant = self.load_active_tenant(token.tenant_id).await?;

        // Rotate: the presented token is spent, a new one takes its place.
        self.refresh_tokens.revoke_by_hash(&hash).await?;
        let issued = self.issue_tokens(&user, &tenant, session.id).await?;
        self.sessions.touch(session.id).await?;
        tracing::info!(user_id = %user.id, session_id = %session.id, "tokens refreshed");
        Ok(RefreshResponse {
            access_token: issued.access_token,
            refresh_token: issued.refresh_token,
            token_type: "Bearer",
            expires_in: issued.expires_in,
        })
    }

    pub async fn logout(&self, ctx: &AuthContext) -> Result<(), AuthError> {
        let user_id = ctx.user_id().ok_or(AuthError::Unauthorized)?;
        if let Some(session_id) = ctx.session_id {
            self.refresh_tokens.revoke_by_session(session_id).await?;
            self.sessions.revoke(session_id).await?;
        }
        tracing::info!(user_id = %user_id, tenant_id = %ctx.tenant_id, "logout");
        Ok(())
    }

    pub async fn logout_all(&self, ctx: &AuthContext) -> Result<(), AuthError> {
        let user_id = ctx.user_id().ok_or(AuthError::Unauthorized)?;
        self.refresh_tokens.revoke_all_by_user(user_id).await?;
        self.sessions.revoke_all_by_user(user_id).await?;
        tracing::info!(user_id = %user_id, tenant_id = %ctx.tenant_id, "logout from all devices");
        Ok(())
    }

    pub async fn me(&self, ctx: &AuthContext) -> Result<MeResponse, AuthError> {
        let user_id = ctx.user_id().ok_or(AuthError::Unauthorized)?;
        let user = self
            .users
            .get_by_id(ctx.tenant_id, user_id)
            .await?
            .ok_or(AuthError::Unauthorized)?;
        let tenant = self
            .tenants
            .get_by_id(ctx.tenant_id)
            .await?
            .ok_or(AuthError::Unauthorized)?;
        let effective_scopes = self.roles.effective_scopes(ctx.tenant_id, user_id).await?;
        Ok(MeResponse {
            user: UserResponse::from(&user),
            tenant: TenantResponse::from(&tenant),
            effective_scopes,
            session_id: ctx.session_id,
        })
    }

    pub async fn sessions(&self, ctx: &AuthContext) -> Result<SessionsResponse, AuthError> {
        let user_id = ctx.user_id().ok_or(AuthError::Unauthorized)?;
        let sessions = self.sessions.list_active_by_user(user_id).await?;
        let sessions: Vec<SessionResponse> = sessions
            .iter()
            .map(|s| SessionResponse::from_session(s, ctx.session_id))
            .collect();
        Ok(SessionsResponse {
            count: sessions.len(),
            sessions,
        })
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    async fn issue_session(
        &self,
        user: &User,
        tenant: &Tenant,
        client: &ClientInfo,
    ) -> Result<TokenResponse, AuthError> {
        // Enforce the per-user session limit by evicting the oldest.
        let active = self.sessions.count_active(user.id).await?;
        if active >= self.config.session.max_per_user {
            if let Some(oldest) = self.sessions.oldest_active(user.id).await? {
                self.refresh_tokens.revoke_by_session(oldest.id).await?;
                self.sessions.revoke(oldest.id).await?;
                tracing::info!(user_id = %user.id, evicted_session = %oldest.id, "session limit reached; oldest session evicted");
            }
        }

        let now = Utc::now();
        let refresh_ttl =
            ChronoDuration::from_std(self.config.jwt.refresh_ttl).unwrap_or_else(|_| ChronoDuration::days(7));
        let session = Session {
            id: SessionId::generate(),
            user_id: user.id,
            tenant_id: tenant.id,
            ip_address: client.ip_address.clone(),
            user_agent: client.user_agent.chars().take(512).collect(),
            expires_at: now + refresh_ttl,
            revoked_at: None,
            created_at: now,
            last_activity_at: now,
        };
        self.sessions.insert(&session).await?;

        let issued = self.issue_tokens(user, tenant, session.id).await?;
        Ok(TokenResponse {
            access_token: issued.access_token,
            refresh_token: issued.refresh_token,
            token_type: "Bearer",
            expires_in: issued.expires_in,
            user: UserResponse::from(user),
            tenant: TenantResponse::from(tenant),
        })
    }

    async fn issue_tokens(
        &self,
        user: &User,
        tenant: &Tenant,
        session_id: SessionId,
    ) -> Result<IssuedTokens, AuthError> {
        let scopes = self.roles.effective_scopes(tenant.id, user.id).await?;
        let (access_token, expires_in) = self.jwt.issue(user, session_id, scopes)?;

        let (raw_refresh, refresh_hash) = generate_refresh_token()?;
        let now = Utc::now();
        let refresh_ttl =
            ChronoDuration::from_std(self.config.jwt.refresh_ttl).unwrap_or_else(|_| ChronoDuration::days(7));
        self.refresh_tokens
            .insert(&RefreshToken {
                id: Uuid::new_v4(),
                token_hash: refresh_hash,
                user_id: user.id,
                tenant_id: tenant.id,
                session_id,
                credential_version: user.credential_version,
                expires_at: now + refresh_ttl,
                revoked_at: None,
                created_at: now,
            })
            .await?;

        Ok(IssuedTokens {
            access_token,
            refresh_token: raw_refresh,
            expires_in,
        })
    }

    async fn load_active_tenant(&self, id: TenantId) -> Result<Tenant, AuthError> {
        let tenant = self.tenants.get_by_id(id).await?.ok_or(TenantError::NotFound)?;
        if !tenant.is_active() {
            return Err(TenantError::Suspended.into());
        }
        Ok(tenant)
    }
}

struct IssuedTokens {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

fn normalize_email(email: &str) -> String {
    email.trim().to_ascii_lowercase()
}
