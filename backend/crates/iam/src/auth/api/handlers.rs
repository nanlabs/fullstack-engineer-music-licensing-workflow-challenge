use actix_web::cookie::time::Duration as CookieDuration;
use actix_web::cookie::Cookie;
use actix_web::http::header::USER_AGENT;
use actix_web::{web, HttpRequest, HttpResponse};
use errx::{AppError, ValidatedJson};

use crate::auth::extract::Auth;
use crate::auth::{
    ClientInfo, InitiateLoginRequest, InitiateSignupRequest, LookupInvitationRequest, MembershipsRequest,
    RefreshRequest, ResendOtpRequest, VerifyLoginRequest, VerifySignupRequest,
};
use crate::config::CookieConfig;
use crate::Container;

// --------------------------------------------------------------------------
// Public: discovery, signup, login
// --------------------------------------------------------------------------

/// POST /auth/passwordless/tenants
pub async fn memberships(
    container: web::Data<Container>,
    body: ValidatedJson<MembershipsRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.memberships(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// POST /auth/passwordless/signup/invitation
pub async fn lookup_invitation(
    container: web::Data<Container>,
    body: ValidatedJson<LookupInvitationRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.lookup_invitation(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// POST /auth/passwordless/signup/initiate
pub async fn initiate_signup(
    container: web::Data<Container>,
    body: ValidatedJson<InitiateSignupRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.initiate_signup(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// POST /auth/passwordless/signup/verify
pub async fn verify_signup(
    container: web::Data<Container>,
    body: ValidatedJson<VerifySignupRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.verify_signup(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// POST /auth/passwordless/login/initiate
pub async fn initiate_login(
    container: web::Data<Container>,
    body: ValidatedJson<InitiateLoginRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.initiate_login(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// POST /auth/passwordless/login/verify
pub async fn verify_login(
    container: web::Data<Container>,
    req: HttpRequest,
    body: ValidatedJson<VerifyLoginRequest>,
) -> Result<HttpResponse, AppError> {
    let tokens = container
        .auth_service
        .verify_login(body.into_inner(), client_info(&req))
        .await?;
    let (access, refresh) = auth_cookies(&container, &tokens.access_token, &tokens.refresh_token);
    Ok(HttpResponse::Ok().cookie(access).cookie(refresh).json(tokens))
}

/// POST /auth/passwordless/resend-otp
pub async fn resend_otp(
    container: web::Data<Container>,
    body: ValidatedJson<ResendOtpRequest>,
) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.resend_otp(body.into_inner()).await?;
    Ok(HttpResponse::Ok().json(res))
}

// --------------------------------------------------------------------------
// Tokens and sessions
// --------------------------------------------------------------------------

/// POST /auth/refresh — body `{ "refresh_token" }` or the refresh cookie.
pub async fn refresh(
    container: web::Data<Container>,
    req: HttpRequest,
    body: Option<web::Json<RefreshRequest>>,
) -> Result<HttpResponse, AppError> {
    let from_body = body
        .and_then(|b| b.into_inner().refresh_token)
        .filter(|t| !t.trim().is_empty());
    let from_cookie = req
        .cookie(&container.config.cookie.refresh_token_name)
        .map(|c| c.value().to_owned())
        .filter(|t| !t.is_empty());
    let raw = from_body
        .or(from_cookie)
        .ok_or_else(|| AppError::validation("refresh_token is required (body or cookie)"))?;

    let tokens = container.auth_service.refresh(&raw, &client_info(&req)).await?;
    let (access, refresh) = auth_cookies(&container, &tokens.access_token, &tokens.refresh_token);
    Ok(HttpResponse::Ok().cookie(access).cookie(refresh).json(tokens))
}

/// POST /auth/logout
pub async fn logout(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    container.auth_service.logout(&auth).await?;
    let (access, refresh) = removal_cookies(&container.config.cookie);
    Ok(HttpResponse::Ok()
        .cookie(access)
        .cookie(refresh)
        .json(serde_json::json!({ "message": "Logged out successfully" })))
}

/// POST /auth/logout/all
pub async fn logout_all(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    container.auth_service.logout_all(&auth).await?;
    let (access, refresh) = removal_cookies(&container.config.cookie);
    Ok(HttpResponse::Ok()
        .cookie(access)
        .cookie(refresh)
        .json(serde_json::json!({ "message": "All sessions logged out successfully" })))
}

/// GET /auth/me
pub async fn me(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.me(&auth).await?;
    Ok(HttpResponse::Ok().json(res))
}

/// GET /auth/sessions
pub async fn sessions(container: web::Data<Container>, auth: Auth) -> Result<HttpResponse, AppError> {
    let res = container.auth_service.sessions(&auth).await?;
    Ok(HttpResponse::Ok().json(res))
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

pub fn client_info(req: &HttpRequest) -> ClientInfo {
    ClientInfo {
        ip_address: req
            .connection_info()
            .realip_remote_addr()
            .map(str::to_owned)
            .unwrap_or_default(),
        user_agent: req
            .headers()
            .get(USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default()
            .to_owned(),
    }
}

fn auth_cookies(container: &Container, access_token: &str, refresh_token: &str) -> (Cookie<'static>, Cookie<'static>) {
    let cfg = &container.config.cookie;
    let access = build_cookie(
        cfg,
        &cfg.access_token_name,
        access_token,
        container.config.jwt.access_ttl.as_secs(),
    );
    let refresh = build_cookie(
        cfg,
        &cfg.refresh_token_name,
        refresh_token,
        container.config.jwt.refresh_ttl.as_secs(),
    );
    (access, refresh)
}

fn build_cookie(cfg: &CookieConfig, name: &str, value: &str, max_age_secs: u64) -> Cookie<'static> {
    let mut builder = Cookie::build(name.to_owned(), value.to_owned())
        .path(cfg.path.clone())
        .http_only(cfg.http_only)
        .secure(cfg.secure)
        .same_site(cfg.same_site)
        .max_age(CookieDuration::seconds(max_age_secs as i64));
    if let Some(domain) = &cfg.domain {
        builder = builder.domain(domain.clone());
    }
    builder.finish()
}

fn removal_cookies(cfg: &CookieConfig) -> (Cookie<'static>, Cookie<'static>) {
    let mut access = build_cookie(cfg, &cfg.access_token_name, "", 0);
    access.make_removal();
    let mut refresh = build_cookie(cfg, &cfg.refresh_token_name, "", 0);
    refresh.make_removal();
    (access, refresh)
}
