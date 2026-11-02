//! Adapters for the IAM notifier ports: render the message for the delivery
//! payload and hand it to the transport. Transport errors propagate; the
//! services decide what a failed delivery means (OTP: the request fails;
//! invitation: `delivered: false`, resend later).

use std::sync::Arc;

use async_trait::async_trait;
use errx::AppResult;
use iam::invitation::port::{InvitationDelivery, InvitationNotifier};
use iam::otp::port::{OtpDelivery, OtpNotifier};

use crate::config::NotifxConfig;
use crate::email::EmailSender;
use crate::templates;

pub struct OtpMailer {
    sender: Arc<dyn EmailSender>,
    config: NotifxConfig,
}

impl OtpMailer {
    pub fn new(sender: Arc<dyn EmailSender>, config: NotifxConfig) -> Self {
        Self { sender, config }
    }
}

#[async_trait]
impl OtpNotifier for OtpMailer {
    async fn send_otp(&self, delivery: &OtpDelivery) -> AppResult<()> {
        self.sender.send(&templates::otp_email(delivery, &self.config)).await
    }
}

pub struct InvitationMailer {
    sender: Arc<dyn EmailSender>,
    config: NotifxConfig,
}

impl InvitationMailer {
    pub fn new(sender: Arc<dyn EmailSender>, config: NotifxConfig) -> Self {
        Self { sender, config }
    }
}

#[async_trait]
impl InvitationNotifier for InvitationMailer {
    async fn send_invitation(&self, delivery: &InvitationDelivery) -> AppResult<()> {
        self.sender
            .send(&templates::invitation_email(delivery, &self.config))
            .await
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use iam::otp::OtpPurpose;
    use kernel::TenantId;

    use super::*;
    use crate::memory::MemoryEmailSender;

    #[tokio::test]
    async fn mailers_render_and_send_through_the_transport() {
        let sender = Arc::new(MemoryEmailSender::default());
        let config = NotifxConfig::default();
        let otp = OtpMailer::new(sender.clone(), config.clone());
        let invitations = InvitationMailer::new(sender.clone(), config);

        otp.send_otp(&OtpDelivery {
            contact: "ada@acme.test".into(),
            code: "123456".into(),
            purpose: OtpPurpose::Login,
            expires_at: Utc::now(),
        })
        .await
        .unwrap();
        invitations
            .send_invitation(&InvitationDelivery {
                email: "new@acme.test".into(),
                token: "tok".into(),
                tenant_id: TenantId::generate(),
                tenant_name: "ACME".into(),
                invited_by_name: "Ada".into(),
                expires_at: Utc::now(),
            })
            .await
            .unwrap();

        let sent = sender.sent();
        assert_eq!(sent.len(), 2);
        let code = sender.last_to("ada@acme.test").unwrap();
        assert!(code.subject.starts_with("123456 is your"));
        let invite = sender.last_to("new@acme.test").unwrap();
        assert_eq!(invite.subject, "Ada invited you to ACME");
        assert!(invite.text.contains("#token=tok"));
    }
}
