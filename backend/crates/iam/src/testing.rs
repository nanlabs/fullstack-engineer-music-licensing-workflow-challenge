//! Helpers for integration tests of this crate and of the domain crates.
//! Compiled only with the `test-support` feature (dev-dependencies).
//!
//! - [`Outbox`]: in-memory notifier that captures OTP codes and invitation
//!   tokens instead of printing them.
//! - [`call`]: invokes a test app and renders middleware errors the same way
//!   the real server does, so every reply has a status and a JSON body.
//! - [`login_with_otp`]: the passwordless login in one call.

use std::fmt::Debug;
use std::sync::Mutex;

use actix_http::Request;
use actix_web::body::MessageBody;
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::header::{HeaderMap, SET_COOKIE};
use actix_web::http::StatusCode;
use actix_web::test::{self, TestRequest};
use async_trait::async_trait;
use errx::AppResult;
use serde_json::{json, Value};

use crate::invitation::port::{InvitationDelivery, InvitationNotifier};
use crate::otp::port::{OtpDelivery, OtpNotifier};
use crate::otp::OtpPurpose;

/// Seed data from `migrations/0002_seed_acme.sql`.
pub const ACME_TENANT: &str = "11111111-1111-4111-8111-111111111111";
pub const ACME_ADMIN_EMAIL: &str = "admin@acme.test";
pub const ACME_LICENSING_EMAIL: &str = "licensing@acme.test";
pub const ROLE_LICENSING_MANAGER: &str = "33333333-3333-4333-8333-333333333331";

pub const LOGIN_INITIATE: &str = "/api/v1/auth/passwordless/login/initiate";
pub const LOGIN_VERIFY: &str = "/api/v1/auth/passwordless/login/verify";
pub const SIGNUP_INVITATION: &str = "/api/v1/auth/passwordless/signup/invitation";
pub const SIGNUP_INITIATE: &str = "/api/v1/auth/passwordless/signup/initiate";
pub const SIGNUP_VERIFY: &str = "/api/v1/auth/passwordless/signup/verify";

/// Captures what the console notifiers would print.
#[derive(Default)]
pub struct Outbox {
    otps: Mutex<Vec<(String, String, OtpPurpose)>>,
    invitations: Mutex<Vec<(String, String)>>,
}

impl Outbox {
    /// Most recent code delivered to `contact` for `purpose`. Panics when none was sent.
    pub fn last_otp(&self, contact: &str, purpose: OtpPurpose) -> String {
        self.otps
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find(|(c, _, p)| c == contact && *p == purpose)
            .map(|(_, code, _)| code.clone())
            .expect("otp was delivered")
    }

    /// Most recent invitation token delivered to `email`. Panics when none was sent.
    pub fn last_invitation(&self, email: &str) -> String {
        self.invitations
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find(|(e, _)| e == email)
            .map(|(_, token)| token.clone())
            .expect("invitation was delivered")
    }
}

#[async_trait]
impl OtpNotifier for Outbox {
    async fn send_otp(&self, d: &OtpDelivery) -> AppResult<()> {
        self.otps
            .lock()
            .unwrap()
            .push((d.contact.clone(), d.code.clone(), d.purpose));
        Ok(())
    }
}

#[async_trait]
impl InvitationNotifier for Outbox {
    async fn send_invitation(&self, d: &InvitationDelivery) -> AppResult<()> {
        self.invitations
            .lock()
            .unwrap()
            .push((d.email.clone(), d.token.clone()));
        Ok(())
    }
}

/// A decoded response: status, JSON body (`Null` when empty) and `Set-Cookie` headers.
#[derive(Debug)]
pub struct Reply {
    pub status: StatusCode,
    pub body: Value,
    pub cookies: Vec<String>,
}

impl Reply {
    /// String at a JSON pointer (`/access_token`). Panics with the body when missing.
    pub fn str(&self, pointer: &str) -> String {
        self.body
            .pointer(pointer)
            .and_then(Value::as_str)
            .unwrap_or_else(|| panic!("missing {pointer} in {}", self.body))
            .to_owned()
    }

    /// The `error.code` of an error body.
    pub fn code(&self) -> String {
        self.str("/error/code")
    }
}

/// Calls the app and renders middleware errors the same way the real server
/// does (through `ResponseError`), so every reply has a status and a body.
pub async fn call<S, R, B, E>(app: &S, req: R) -> Reply
where
    S: Service<R, Response = ServiceResponse<B>, Error = E>,
    B: MessageBody,
    E: Debug + Into<actix_web::Error>,
{
    let (status, cookies, bytes) = match test::try_call_service(app, req).await {
        Ok(resp) => {
            let status = resp.status();
            let cookies = set_cookies(resp.headers());
            (status, cookies, test::read_body(resp).await)
        }
        Err(err) => {
            let resp = err.into().error_response();
            let status = resp.status();
            let cookies = set_cookies(resp.headers());
            let bytes = actix_web::body::to_bytes(resp.into_body()).await.expect("error body");
            (status, cookies, bytes)
        }
    };
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };
    Reply { status, body, cookies }
}

fn set_cookies(headers: &HeaderMap) -> Vec<String> {
    headers
        .get_all(SET_COOKIE)
        .filter_map(|v| v.to_str().ok().map(str::to_owned))
        .collect()
}

fn bearer(req: TestRequest, token: &str) -> TestRequest {
    req.insert_header(("authorization", format!("Bearer {token}")))
}

/// Anonymous `POST` with a JSON body.
pub fn post(uri: &str, body: Value) -> TestRequest {
    TestRequest::post().uri(uri).set_json(body)
}

/// `POST` with a JSON body and a bearer token.
pub fn post_as(uri: &str, body: Value, token: &str) -> TestRequest {
    bearer(post(uri, body), token)
}

/// `PUT` with a JSON body and a bearer token.
pub fn put_as(uri: &str, body: Value, token: &str) -> TestRequest {
    bearer(TestRequest::put().uri(uri).set_json(body), token)
}

/// `GET` with a bearer token.
pub fn get_as(uri: &str, token: &str) -> TestRequest {
    bearer(TestRequest::get().uri(uri), token)
}

/// `DELETE` with a bearer token.
pub fn delete_as(uri: &str, token: &str) -> TestRequest {
    bearer(TestRequest::delete().uri(uri), token)
}

/// Tokens issued by a successful login.
#[derive(Debug, Clone)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
}

/// Runs the passwordless login for an active user and returns its tokens.
/// Remember the OTP rate limit: one login per user per minute.
pub async fn login_with_otp<S, B, E>(app: &S, outbox: &Outbox, email: &str, tenant_id: &str) -> Tokens
where
    S: Service<Request, Response = ServiceResponse<B>, Error = E>,
    B: MessageBody,
    E: Debug + Into<actix_web::Error>,
{
    let initiate = json!({ "email": email, "tenant_id": tenant_id });
    let r = call(app, post(LOGIN_INITIATE, initiate).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "login initiate for {email}: {}", r.body);
    let code = outbox.last_otp(email, OtpPurpose::Login);
    let verify = json!({ "email": email, "tenant_id": tenant_id, "code": code });
    let r = call(app, post(LOGIN_VERIFY, verify).to_request()).await;
    assert_eq!(r.status, StatusCode::OK, "login verify for {email}: {}", r.body);
    Tokens {
        access_token: r.str("/access_token"),
        refresh_token: r.str("/refresh_token"),
    }
}
