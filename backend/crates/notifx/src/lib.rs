//! Notification delivery.
//!
//! One message type ([`Email`]), one transport port ([`EmailSender`]) and the
//! adapters that implement the notifier ports of each bounded context on top
//! of it ([`mailers`]). The crate depends on the contexts whose ports it
//! implements, never the other way round: `iam` knows that codes and
//! invitations get delivered, not what a message looks like.
//!
//! Transports: [`ConsoleEmailSender`] prints the rendered message to the log
//! (development only) and [`MemoryEmailSender`] keeps it for tests. A real
//! provider (SMTP, an HTTP API) is a third implementation of the same trait,
//! selected by `NOTIFY_PROVIDER`; see `docs/notifications.md`.

pub mod config;
pub mod console;
pub mod email;
pub mod mailers;
pub mod memory;
pub mod templates;

pub use config::{NotifxConfig, Provider};
pub use console::ConsoleEmailSender;
pub use email::{Email, EmailSender};
pub use mailers::{InvitationMailer, OtpMailer};
pub use memory::MemoryEmailSender;
