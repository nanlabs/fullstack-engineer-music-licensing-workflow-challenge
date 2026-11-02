use std::time::Duration;

use crate::events::EventsConfig;

/// Settings of the licensing context: the expiry sweep and the real-time
/// stream. The workflow itself is pure code.
#[derive(Debug, Clone)]
pub struct LicensingConfig {
    /// How often the background job moves `approved` licenses whose
    /// `expires_at` has passed to `expired`.
    pub expiry_sweep_interval: Duration,
    pub events: EventsConfig,
}

impl Default for LicensingConfig {
    fn default() -> Self {
        Self {
            expiry_sweep_interval: Duration::from_secs(5 * 60),
            events: EventsConfig::default(),
        }
    }
}
