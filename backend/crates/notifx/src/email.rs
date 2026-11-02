use async_trait::async_trait;
use errx::AppResult;

/// A plain-text message. The sender knows the `From`; the message only says
/// where it goes and what it says. HTML bodies are an extension, not a need.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email {
    pub to: String,
    pub subject: String,
    pub text: String,
}

/// Transport port. The console sender prints, the memory sender records;
/// SMTP or an HTTP provider implement the same trait.
#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send(&self, email: &Email) -> AppResult<()>;
}
