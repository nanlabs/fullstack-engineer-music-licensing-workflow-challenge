//! Development transport: the rendered message goes to the log instead of a
//! mailbox. Codes and tokens are credentials, so this sender says on every
//! message that it is a development path, and writes with the target
//! `notifx::console` so the output can be silenced where logs are shipped
//! (`RUST_LOG=...,notifx::console=off`).

use async_trait::async_trait;
use errx::AppResult;

use crate::config::NotifxConfig;
use crate::email::{Email, EmailSender};

pub const HEADER: &str = "---- email (console delivery, development only) ----";
pub const FOOTER: &str = "---- end of email ----";

pub struct ConsoleEmailSender {
    config: NotifxConfig,
}

impl ConsoleEmailSender {
    pub fn new(config: NotifxConfig) -> Self {
        Self { config }
    }

    /// The block as it is printed: headers, blank line, body.
    pub fn render(&self, email: &Email) -> String {
        format!(
            "{HEADER}\nFrom: {}\nTo: {}\nSubject: {}\n\n{}\n{FOOTER}",
            self.config.from_header(),
            email.to,
            email.subject,
            email.text.trim_end(),
        )
    }
}

#[async_trait]
impl EmailSender for ConsoleEmailSender {
    async fn send(&self, email: &Email) -> AppResult<()> {
        // The block starts and ends on its own lines so the compact log format
        // prints it readably (the request span fields land after the footer);
        // in JSON it is one escaped string.
        tracing::warn!(target: "notifx::console", "\n{}\n", self.render(email));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_headers_and_body() {
        let sender = ConsoleEmailSender::new(NotifxConfig::default());
        let email = Email {
            to: "someone@acme.test".into(),
            subject: "Hello".into(),
            text: "Line one\nLine two\n".into(),
        };
        let block = sender.render(&email);
        let lines: Vec<&str> = block.lines().collect();
        assert_eq!(lines[0], HEADER);
        assert_eq!(lines[1], "From: Music Licensing <no-reply@music-licensing.local>");
        assert_eq!(lines[2], "To: someone@acme.test");
        assert_eq!(lines[3], "Subject: Hello");
        assert_eq!(lines[4], "");
        assert_eq!(lines[5], "Line one");
        assert_eq!(lines[6], "Line two");
        assert_eq!(lines[7], FOOTER);
        assert_eq!(lines.len(), 8);
    }

    #[tokio::test]
    async fn send_never_fails() {
        let sender = ConsoleEmailSender::new(NotifxConfig::default());
        let email = Email {
            to: "a@b.co".into(),
            subject: "s".into(),
            text: "t".into(),
        };
        assert!(sender.send(&email).await.is_ok());
    }
}
