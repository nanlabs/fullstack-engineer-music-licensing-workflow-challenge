use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::kernel::UserId;

// ============================================================================
// User Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserStatus {
    Active,
    Inactive,
    Suspended,
    Pending,
}

impl TryFrom<&str> for UserStatus {
    type Error = AppError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "ACTIVE" => Ok(Self::Active),
            "INACTIVE" => Ok(Self::Inactive),
            "SUSPENDED" => Ok(Self::Suspended),
            "PENDING" => Ok(Self::Pending),
            _ => Err(AppError::validation(format!("Invalid user status: {s}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OAuthProvider {
    Google,
    Microsoft,
}

impl TryFrom<&str> for OAuthProvider {
    type Error = AppError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "GOOGLE" => Ok(Self::Google),
            "MICROSOFT" => Ok(Self::Microsoft),
            _ => Err(AppError::validation(format!("Invalid OAuth provider: {s}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: UserId,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,

    // Auth: password OR OAuth (at least one must be set)
    pub password_hash: Option<String>,
    pub oauth_provider: Option<OAuthProvider>,
    pub oauth_provider_id: Option<String>,

    pub status: UserStatus,
    pub email_verified: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Domain Methods
// ============================================================================

impl User {
    pub fn new_with_password(email: String, name: String, password_hash: String) -> Self {
        let now = Utc::now();
        Self {
            id: UserId::new(),
            email,
            name,
            picture: None,
            password_hash: Some(password_hash),
            oauth_provider: None,
            oauth_provider_id: None,
            status: UserStatus::Pending,
            email_verified: false,
            last_login_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn new_with_oauth(
        email: String,
        name: String,
        picture: Option<String>,
        provider: OAuthProvider,
        provider_id: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: UserId::new(),
            email,
            name,
            picture,
            password_hash: None,
            oauth_provider: Some(provider),
            oauth_provider_id: Some(provider_id),
            status: UserStatus::Active,
            email_verified: true,
            last_login_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn has_password(&self) -> bool {
        self.password_hash.is_some()
    }

    pub fn has_oauth(&self) -> bool {
        self.oauth_provider.is_some() && self.oauth_provider_id.is_some()
    }

    pub fn link_oauth(&mut self, provider: OAuthProvider, provider_id: String) {
        self.oauth_provider = Some(provider);
        self.oauth_provider_id = Some(provider_id);
        self.updated_at = Utc::now();
    }

    pub fn is_active(&self) -> bool {
        self.status == UserStatus::Active
    }

    pub fn can_login(&self) -> bool {
        self.is_active() && self.email_verified
    }

    pub fn activate(&mut self) -> Result<(), AppError> {
        if self.status != UserStatus::Pending {
            return Err(super::UserError::invalid_status().with_detail(
                "current_status",
                serde_json::to_value(&self.status).unwrap(),
            ));
        }
        self.status = UserStatus::Active;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn suspend(&mut self, _reason: &str) -> Result<(), AppError> {
        if !self.is_active() {
            return Err(super::UserError::invalid_status().with_detail(
                "current_status",
                serde_json::to_value(&self.status).unwrap(),
            ));
        }
        self.status = UserStatus::Suspended;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn update_last_login(&mut self) {
        let now = Utc::now();
        self.last_login_at = Some(now);
        self.updated_at = now;
    }

    pub fn update_profile(&mut self, name: Option<String>, picture: Option<String>) {
        if let Some(name) = name {
            self.name = name;
        }
        if let Some(pic) = picture {
            self.picture = Some(pic);
        }
        self.updated_at = Utc::now();
    }
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Serialize)]
pub struct UserDetailsDTO {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub picture: Option<String>,
    pub is_active: bool,
}

impl From<&User> for UserDetailsDTO {
    fn from(u: &User) -> Self {
        Self {
            id: u.id.clone(),
            name: u.name.clone(),
            email: u.email.clone(),
            picture: u.picture.clone(),
            is_active: u.is_active(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

impl CreateUserRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if !self.email.contains('@') {
            return Err(
                AppError::validation("A valid email is required").with_detail("field", "email")
            );
        }
        if self.name.trim().len() < 2 {
            return Err(AppError::validation("Name must be at least 2 characters")
                .with_detail("field", "name"));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub status: Option<UserStatus>,
}

impl UpdateUserRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(ref name) = self.name
            && name.trim().len() < 2
        {
            return Err(AppError::validation("Name must be at least 2 characters")
                .with_detail("field", "name"));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct SuspendUserRequest {
    pub reason: String,
}

impl SuspendUserRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.reason.trim().is_empty() {
            return Err(AppError::validation("Reason is required").with_detail("field", "reason"));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: UserId,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    pub has_password: bool,
    pub oauth_provider: Option<OAuthProvider>,
    pub status: UserStatus,
    pub email_verified: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        let has_password = u.has_password();
        Self {
            id: u.id,
            email: u.email,
            name: u.name,
            picture: u.picture,
            has_password,
            oauth_provider: u.oauth_provider,
            status: u.status,
            email_verified: u.email_verified,
            last_login_at: u.last_login_at,
            created_at: u.created_at,
            updated_at: u.updated_at,
        }
    }
}

// ============================================================================
// Filters
// ============================================================================

#[derive(Debug, Default, Deserialize)]
pub struct UserFilter {
    pub search: Option<String>,
    pub status: Option<UserStatus>,
}
