//! The messages, as plain text built by functions. Two messages do not need
//! a template engine; when HTML or localisation arrive, this module is the
//! only one that changes.

use chrono::{DateTime, Utc};
use iam::invitation::port::InvitationDelivery;
use iam::otp::port::OtpDelivery;
use iam::otp::OtpPurpose;

use crate::config::NotifxConfig;
use crate::email::Email;

/// Frontend route that reads the token from `location.hash`.
pub const ACCEPT_PATH: &str = "/accept-invitation";

/// `{APP_PUBLIC_URL}/accept-invitation#token=<token>`. The token travels in
/// the fragment, which browsers never send to a server, so it stays out of
/// access logs and `Referer` headers.
pub fn accept_link(app_public_url: &str, token: &str) -> String {
    format!("{}{ACCEPT_PATH}#token={token}", app_public_url.trim_end_matches('/'))
}

fn stamp(at: DateTime<Utc>) -> String {
    at.format("%Y-%m-%d %H:%M UTC").to_string()
}

pub fn otp_email(d: &OtpDelivery, config: &NotifxConfig) -> Email {
    let brand = &config.from_name;
    let (subject, action) = match d.purpose {
        OtpPurpose::Login => (
            format!("{} is your {brand} sign-in code", d.code),
            format!("Use this code to sign in to {brand}:"),
        ),
        OtpPurpose::Signup => (
            format!("{} is your {brand} verification code", d.code),
            format!("Use this code to verify your email and finish creating your {brand} account:"),
        ),
    };
    let text = format!(
        "Hi,\n\n{action}\n\n    {}\n\nIt expires at {}.\n\nIf you did not request it, ignore this message.\n",
        d.code,
        stamp(d.expires_at),
    );
    Email {
        to: d.contact.clone(),
        subject,
        text,
    }
}

pub fn invitation_email(d: &InvitationDelivery, config: &NotifxConfig) -> Email {
    let link = accept_link(&config.app_public_url, &d.token);
    let subject = format!("{} invited you to {}", d.invited_by_name, d.tenant_name);
    let text = format!(
        "Hi,\n\n{} invited you to join {} on {}.\n\nAccept the invitation:\n\n    {link}\n\n\
         The invitation expires on {}. If you did not expect it, ignore this message.\n",
        d.invited_by_name,
        d.tenant_name,
        config.from_name,
        stamp(d.expires_at),
    );
    Email {
        to: d.email.clone(),
        subject,
        text,
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;
    use kernel::TenantId;

    use super::*;

    fn at() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 2, 9, 30, 0).unwrap()
    }

    #[test]
    fn accept_link_puts_the_token_in_the_fragment() {
        assert_eq!(
            accept_link("http://localhost:5173/", "abc_DEF-123"),
            "http://localhost:5173/accept-invitation#token=abc_DEF-123"
        );
        assert_eq!(
            accept_link("https://app.example.com", "t"),
            "https://app.example.com/accept-invitation#token=t"
        );
    }

    #[test]
    fn otp_login_and_signup_messages() {
        let config = NotifxConfig::default();
        let login = otp_email(
            &OtpDelivery {
                contact: "ada@acme.test".into(),
                code: "482913".into(),
                purpose: OtpPurpose::Login,
                expires_at: at(),
            },
            &config,
        );
        assert_eq!(login.to, "ada@acme.test");
        assert_eq!(login.subject, "482913 is your Music Licensing sign-in code");
        assert!(login.text.contains("sign in to Music Licensing"));
        assert!(login.text.contains("    482913\n"));
        assert!(login.text.contains("expires at 2026-11-02 09:30 UTC"));

        let signup = otp_email(
            &OtpDelivery {
                contact: "new@acme.test".into(),
                code: "000111".into(),
                purpose: OtpPurpose::Signup,
                expires_at: at(),
            },
            &config,
        );
        assert_eq!(signup.subject, "000111 is your Music Licensing verification code");
        assert!(signup.text.contains("finish creating your Music Licensing account"));
    }

    #[test]
    fn invitation_message_has_link_tenant_and_inviter() {
        let config = NotifxConfig::default();
        let email = invitation_email(
            &InvitationDelivery {
                email: "new@acme.test".into(),
                token: "tok_en".into(),
                tenant_id: TenantId::generate(),
                tenant_name: "ACME BROS Pictures".into(),
                invited_by_name: "Ada Admin".into(),
                expires_at: at(),
            },
            &config,
        );
        assert_eq!(email.to, "new@acme.test");
        assert_eq!(email.subject, "Ada Admin invited you to ACME BROS Pictures");
        assert!(email
            .text
            .contains("Ada Admin invited you to join ACME BROS Pictures on Music Licensing."));
        assert!(email
            .text
            .contains("    http://localhost:5173/accept-invitation#token=tok_en\n"));
        assert!(email.text.contains("expires on 2026-11-02 09:30 UTC"));
    }
}
