//! Development notifiers. They print codes and tokens to the log instead of
//! sending email. Production wiring must replace them with a real channel;
//! the warning on every send is intentional.

use async_trait::async_trait;
use errx::AppResult;
use iam::invitation::port::InvitationNotifier;
use iam::otp::port::OtpNotifier;
use iam::otp::OtpPurpose;
use kernel::{TenantId, UserId};

pub struct ConsoleOtpNotifier;

#[async_trait]
impl OtpNotifier for ConsoleOtpNotifier {
    async fn send_otp(&self, contact: &str, code: &str, purpose: OtpPurpose) -> AppResult<()> {
        tracing::warn!(
            target: "notifier::console",
            contact,
            code,
            purpose = purpose.as_str(),
            "OTP code (console delivery, development only)"
        );
        Ok(())
    }
}

pub struct ConsoleInvitationNotifier;

#[async_trait]
impl InvitationNotifier for ConsoleInvitationNotifier {
    async fn send_invitation(
        &self,
        email: &str,
        token: &str,
        tenant_id: TenantId,
        invited_by: UserId,
    ) -> AppResult<()> {
        tracing::warn!(
            target: "notifier::console",
            email,
            invitation_token = token,
            tenant_id = %tenant_id,
            invited_by = %invited_by,
            "invitation token (console delivery, development only)"
        );
        Ok(())
    }
}
