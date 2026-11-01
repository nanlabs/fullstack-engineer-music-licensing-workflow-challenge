use std::sync::Arc;

use chrono::{Duration as ChronoDuration, Utc};
use errx::AppError;
use kernel::OtpId;
use subtle::ConstantTimeEq;

use super::port::{OtpNotifier, OtpRepository};
use super::{hash_code, normalize_contact, Otp, OtpError, OtpPurpose};
use crate::config::OtpConfig;

pub struct OtpService {
    repo: Arc<dyn OtpRepository>,
    notifier: Arc<dyn OtpNotifier>,
    config: OtpConfig,
}

impl OtpService {
    pub fn new(repo: Arc<dyn OtpRepository>, notifier: Arc<dyn OtpNotifier>, config: OtpConfig) -> Self {
        Self { repo, notifier, config }
    }

    /// Creates a code, stores its hash and hands the raw code to the notifier.
    /// Rate limited per contact and purpose while a previous code is valid.
    pub async fn generate(&self, contact: &str, purpose: OtpPurpose) -> Result<Otp, OtpError> {
        let contact = normalize_contact(contact);
        let now = Utc::now();

        if let Some(existing) = self.repo.latest_by_contact(&contact, purpose).await? {
            if existing.is_valid(now) {
                let window = ChronoDuration::from_std(self.config.rate_limit_window)
                    .unwrap_or_else(|_| ChronoDuration::seconds(60));
                let elapsed = now - existing.created_at;
                if elapsed < window {
                    let retry_after_secs = (window - elapsed).num_seconds().max(1) as u64;
                    return Err(OtpError::TooManyRequests { retry_after_secs });
                }
            }
        }

        let code = generate_code(self.config.code_length)?;
        let ttl = ChronoDuration::from_std(self.config.ttl).unwrap_or_else(|_| ChronoDuration::minutes(10));
        let otp = Otp {
            id: OtpId::generate(),
            code_hash: hash_code(&contact, purpose, &code),
            contact,
            purpose,
            expires_at: now + ttl,
            verified_at: None,
            attempts: 0,
            max_attempts: self.config.max_attempts,
            created_at: now,
        };
        self.repo.insert(&otp).await?;
        self.notifier.send_otp(&otp.contact, &code, purpose).await?;
        tracing::info!(contact = %otp.contact, purpose = purpose.as_str(), "otp issued");
        Ok(otp)
    }

    /// Verifies a code. The lookup is by contact and purpose, never by code,
    /// so wrong guesses always count against the same record.
    pub async fn verify(&self, contact: &str, code: &str, purpose: OtpPurpose) -> Result<Otp, OtpError> {
        let contact = normalize_contact(contact);
        let now = Utc::now();

        let otp = self
            .repo
            .latest_by_contact(&contact, purpose)
            .await?
            .ok_or(OtpError::Invalid { attempts_remaining: 0 })?;

        if otp.is_expired(now) {
            return Err(OtpError::Expired);
        }
        if otp.is_verified() {
            return Err(OtpError::AlreadyUsed);
        }
        if otp.attempts_remaining() == 0 {
            return Err(OtpError::TooManyAttempts);
        }

        let candidate = hash_code(&contact, purpose, code);
        let matches = bool::from(candidate.as_slice().ct_eq(otp.code_hash.as_slice()));

        let Some(updated) = self.repo.record_attempt(otp.id, matches).await? else {
            // Lost a race: someone consumed or exhausted the code meanwhile.
            return Err(if matches {
                OtpError::AlreadyUsed
            } else {
                OtpError::TooManyAttempts
            });
        };

        if !matches {
            tracing::warn!(contact = %contact, purpose = purpose.as_str(), attempts = updated.attempts, "otp verification failed");
            return Err(OtpError::Invalid {
                attempts_remaining: updated.attempts_remaining(),
            });
        }
        tracing::info!(contact = %contact, purpose = purpose.as_str(), "otp verified");
        Ok(updated)
    }

    pub async fn delete_expired(&self) -> Result<u64, OtpError> {
        Ok(self.repo.delete_expired().await?)
    }
}

/// Uniform random numeric code from the OS CSPRNG (rejection sampling avoids
/// modulo bias).
pub fn generate_code(length: u8) -> Result<String, AppError> {
    let length = length.clamp(4, 10);
    let max = 10u64.pow(u32::from(length));
    let limit = u64::MAX - (u64::MAX % max);
    loop {
        let mut bytes = [0u8; 8];
        getrandom::fill(&mut bytes)
            .map_err(|e| AppError::internal("Random generator unavailable").with_source(anyhow::anyhow!(e)))?;
        let n = u64::from_le_bytes(bytes);
        if n < limit {
            return Ok(format!("{:0width$}", n % max, width = usize::from(length)));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use std::time::Duration;

    use async_trait::async_trait;
    use errx::AppResult;

    use super::*;

    #[derive(Default)]
    struct FakeRepo {
        rows: Mutex<Vec<Otp>>,
    }

    #[async_trait]
    impl OtpRepository for FakeRepo {
        async fn insert(&self, otp: &Otp) -> AppResult<()> {
            self.rows.lock().unwrap().push(otp.clone());
            Ok(())
        }

        async fn latest_by_contact(&self, contact: &str, purpose: OtpPurpose) -> AppResult<Option<Otp>> {
            Ok(self
                .rows
                .lock()
                .unwrap()
                .iter()
                .filter(|o| o.contact == contact && o.purpose == purpose)
                .max_by_key(|o| o.created_at)
                .cloned())
        }

        async fn record_attempt(&self, id: OtpId, verified: bool) -> AppResult<Option<Otp>> {
            let mut rows = self.rows.lock().unwrap();
            let Some(row) = rows.iter_mut().find(|o| o.id == id) else {
                return Ok(None);
            };
            if row.verified_at.is_some() || row.attempts >= row.max_attempts {
                return Ok(None);
            }
            row.attempts += 1;
            if verified {
                row.verified_at = Some(Utc::now());
            }
            Ok(Some(row.clone()))
        }

        async fn delete_expired(&self) -> AppResult<u64> {
            let mut rows = self.rows.lock().unwrap();
            let before = rows.len();
            rows.retain(|o| !o.is_expired(Utc::now()));
            Ok((before - rows.len()) as u64)
        }
    }

    #[derive(Default)]
    struct FakeNotifier {
        sent: Mutex<Vec<(String, String, OtpPurpose)>>,
    }

    impl FakeNotifier {
        fn last_code(&self) -> String {
            self.sent.lock().unwrap().last().unwrap().1.clone()
        }
    }

    #[async_trait]
    impl OtpNotifier for FakeNotifier {
        async fn send_otp(&self, contact: &str, code: &str, purpose: OtpPurpose) -> AppResult<()> {
            self.sent
                .lock()
                .unwrap()
                .push((contact.to_string(), code.to_string(), purpose));
            Ok(())
        }
    }

    fn config() -> OtpConfig {
        OtpConfig {
            code_length: 6,
            ttl: Duration::from_secs(600),
            max_attempts: 3,
            rate_limit_window: Duration::from_secs(60),
        }
    }

    fn service(repo: &Arc<FakeRepo>, notifier: &Arc<FakeNotifier>) -> OtpService {
        OtpService::new(repo.clone(), notifier.clone(), config())
    }

    #[tokio::test]
    async fn generates_hashed_code_and_verifies_it() {
        let repo = Arc::new(FakeRepo::default());
        let notifier = Arc::new(FakeNotifier::default());
        let svc = service(&repo, &notifier);

        let otp = svc.generate("Ana@Example.com", OtpPurpose::Login).await.unwrap();
        let code = notifier.last_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
        assert_eq!(otp.contact, "ana@example.com");
        assert_ne!(otp.code_hash, code.as_bytes());

        let verified = svc.verify("ana@example.com", &code, OtpPurpose::Login).await.unwrap();
        assert!(verified.is_verified());
        assert_eq!(verified.attempts, 1);
    }

    #[tokio::test]
    async fn wrong_codes_count_attempts_until_locked() {
        let repo = Arc::new(FakeRepo::default());
        let notifier = Arc::new(FakeNotifier::default());
        let svc = service(&repo, &notifier);
        svc.generate("a@b.co", OtpPurpose::Login).await.unwrap();

        for remaining in [2, 1, 0] {
            let err = svc.verify("a@b.co", "000000", OtpPurpose::Login).await.unwrap_err();
            assert!(matches!(err, OtpError::Invalid { attempts_remaining } if attempts_remaining == remaining));
        }
        let err = svc
            .verify("a@b.co", &notifier.last_code(), OtpPurpose::Login)
            .await
            .unwrap_err();
        assert!(matches!(err, OtpError::TooManyAttempts));
    }

    #[tokio::test]
    async fn rate_limits_while_previous_code_is_valid() {
        let repo = Arc::new(FakeRepo::default());
        let notifier = Arc::new(FakeNotifier::default());
        let svc = service(&repo, &notifier);
        svc.generate("a@b.co", OtpPurpose::Signup).await.unwrap();
        let err = svc.generate("a@b.co", OtpPurpose::Signup).await.unwrap_err();
        assert!(
            matches!(err, OtpError::TooManyRequests { retry_after_secs } if retry_after_secs > 0 && retry_after_secs <= 60)
        );
        // A different purpose has its own limit.
        assert!(svc.generate("a@b.co", OtpPurpose::Login).await.is_ok());
    }

    #[tokio::test]
    async fn purpose_is_bound_to_the_code() {
        let repo = Arc::new(FakeRepo::default());
        let notifier = Arc::new(FakeNotifier::default());
        let svc = service(&repo, &notifier);
        svc.generate("a@b.co", OtpPurpose::Signup).await.unwrap();
        let code = notifier.last_code();
        let err = svc.verify("a@b.co", &code, OtpPurpose::Login).await.unwrap_err();
        assert!(matches!(err, OtpError::Invalid { .. }));
    }

    #[tokio::test]
    async fn expired_and_used_codes_are_rejected() {
        let repo = Arc::new(FakeRepo::default());
        let notifier = Arc::new(FakeNotifier::default());
        let svc = service(&repo, &notifier);

        let now = Utc::now();
        repo.insert(&Otp {
            id: OtpId::generate(),
            contact: "old@b.co".into(),
            code_hash: hash_code("old@b.co", OtpPurpose::Login, "123456"),
            purpose: OtpPurpose::Login,
            expires_at: now - ChronoDuration::seconds(1),
            verified_at: None,
            attempts: 0,
            max_attempts: 3,
            created_at: now - ChronoDuration::minutes(11),
        })
        .await
        .unwrap();
        assert!(matches!(
            svc.verify("old@b.co", "123456", OtpPurpose::Login).await.unwrap_err(),
            OtpError::Expired
        ));
        // Expired codes do not block a new request.
        assert!(svc.generate("old@b.co", OtpPurpose::Login).await.is_ok());

        let code = notifier.last_code();
        svc.verify("old@b.co", &code, OtpPurpose::Login).await.unwrap();
        assert!(matches!(
            svc.verify("old@b.co", &code, OtpPurpose::Login).await.unwrap_err(),
            OtpError::AlreadyUsed
        ));
    }

    #[test]
    fn generated_codes_have_fixed_width() {
        for _ in 0..200 {
            let code = generate_code(6).unwrap();
            assert_eq!(code.len(), 6);
            assert!(code.parse::<u32>().is_ok());
        }
        assert_eq!(generate_code(4).unwrap().len(), 4);
        assert_eq!(generate_code(10).unwrap().len(), 10);
    }
}
