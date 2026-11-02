use std::sync::Mutex;

use async_trait::async_trait;
use errx::AppResult;

use crate::email::{Email, EmailSender};

/// Records messages instead of sending them. For tests of this crate and of
/// anything that composes a sender.
#[derive(Debug, Default)]
pub struct MemoryEmailSender {
    sent: Mutex<Vec<Email>>,
}

impl MemoryEmailSender {
    pub fn sent(&self) -> Vec<Email> {
        self.sent.lock().unwrap().clone()
    }

    /// Most recent message addressed to `to`.
    pub fn last_to(&self, to: &str) -> Option<Email> {
        self.sent.lock().unwrap().iter().rev().find(|e| e.to == to).cloned()
    }
}

#[async_trait]
impl EmailSender for MemoryEmailSender {
    async fn send(&self, email: &Email) -> AppResult<()> {
        self.sent.lock().unwrap().push(email.clone());
        Ok(())
    }
}
