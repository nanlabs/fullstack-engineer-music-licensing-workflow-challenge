use std::fmt;
use std::str::FromStr;

use anyhow::bail;

/// Which transport delivers messages. Only the console exists today; a real
/// provider adds a variant here and a sender in `app`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Console,
}

impl Provider {
    pub const SUPPORTED: &'static [&'static str] = &["console"];

    pub fn as_str(self) -> &'static str {
        match self {
            Provider::Console => "console",
        }
    }
}

impl FromStr for Provider {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "console" => Ok(Provider::Console),
            other => bail!(
                "unsupported NOTIFY_PROVIDER '{other}' (supported: {})",
                Self::SUPPORTED.join(", ")
            ),
        }
    }
}

impl fmt::Display for Provider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct NotifxConfig {
    pub provider: Provider,
    /// `From` mailbox of every message.
    pub from_address: String,
    /// Display name of the sender; also the product name inside messages.
    pub from_name: String,
    /// Public origin of the frontend, used to build links.
    pub app_public_url: String,
}

impl NotifxConfig {
    /// `Name <address>`, as it would appear in a `From` header.
    pub fn from_header(&self) -> String {
        format!("{} <{}>", self.from_name, self.from_address)
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if !(self.app_public_url.starts_with("http://") || self.app_public_url.starts_with("https://")) {
            bail!("APP_PUBLIC_URL must start with http:// or https://");
        }
        if !self.from_address.contains('@') {
            bail!("NOTIFY_FROM_ADDRESS must be an email address");
        }
        if self.from_name.trim().is_empty() {
            bail!("NOTIFY_FROM_NAME must not be empty");
        }
        Ok(())
    }
}

impl Default for NotifxConfig {
    fn default() -> Self {
        Self {
            provider: Provider::Console,
            from_address: "no-reply@music-licensing.local".into(),
            from_name: "Music Licensing".into(),
            app_public_url: "http://localhost:5173".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_parses_console_only() {
        assert_eq!("console".parse::<Provider>().unwrap(), Provider::Console);
        assert_eq!(" Console ".parse::<Provider>().unwrap(), Provider::Console);
        let err = "smtp".parse::<Provider>().unwrap_err().to_string();
        assert_eq!(err, "unsupported NOTIFY_PROVIDER 'smtp' (supported: console)");
    }

    #[test]
    fn config_validation() {
        assert!(NotifxConfig::default().validate().is_ok());
        let bad_url = NotifxConfig {
            app_public_url: "localhost:5173".into(),
            ..Default::default()
        };
        assert!(bad_url.validate().unwrap_err().to_string().contains("APP_PUBLIC_URL"));
        let bad_from = NotifxConfig {
            from_address: "nobody".into(),
            ..Default::default()
        };
        assert!(bad_from
            .validate()
            .unwrap_err()
            .to_string()
            .contains("NOTIFY_FROM_ADDRESS"));
        let bad_name = NotifxConfig {
            from_name: "  ".into(),
            ..Default::default()
        };
        assert!(bad_name
            .validate()
            .unwrap_err()
            .to_string()
            .contains("NOTIFY_FROM_NAME"));
    }

    #[test]
    fn from_header_combines_name_and_address() {
        assert_eq!(
            NotifxConfig::default().from_header(),
            "Music Licensing <no-reply@music-licensing.local>"
        );
    }
}
