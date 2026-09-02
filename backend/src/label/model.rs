use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::kernel::{LabelId, UserId};

// ============================================================================
// Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub id: LabelId,
    pub name: String,
    pub website: Option<String>,
    pub contact_email: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Label {
    pub fn new(name: String, website: Option<String>, contact_email: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: LabelId::new(),
            name,
            website,
            contact_email,
            created_at: now,
            updated_at: now,
        }
    }
}

// ============================================================================
// Label Membership
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum LabelRole {
    Owner,
    Rep,
    Artist,
}

impl LabelRole {
    pub fn as_str(&self) -> &str {
        match self {
            LabelRole::Owner => "OWNER",
            LabelRole::Rep => "REP",
            LabelRole::Artist => "ARTIST",
        }
    }
}

impl TryFrom<&str> for LabelRole {
    type Error = AppError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "OWNER" => Ok(LabelRole::Owner),
            "REP" => Ok(LabelRole::Rep),
            "ARTIST" => Ok(LabelRole::Artist),
            _ => Err(AppError::validation(format!("Invalid label role: {value}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelMember {
    pub label_id: LabelId,
    pub user_id: UserId,
    pub role: LabelRole,
    pub joined_at: DateTime<Utc>,
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateLabelRequest {
    pub name: String,
    pub website: Option<String>,
    pub contact_email: Option<String>,
}

impl CreateLabelRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().len() < 2 {
            return Err(
                AppError::validation("Name is required and must be at least 2 characters")
                    .with_detail("field", "name"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateLabelRequest {
    pub name: Option<String>,
    pub website: Option<String>,
    pub contact_email: Option<String>,
}

impl UpdateLabelRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(name) = &self.name
            && name.trim().len() < 2
        {
            return Err(AppError::validation("Name must be at least 2 characters")
                .with_detail("field", "name"));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LabelResponse {
    pub id: LabelId,
    pub name: String,
    pub website: Option<String>,
    pub contact_email: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Label> for LabelResponse {
    fn from(l: &Label) -> Self {
        Self {
            id: l.id.clone(),
            name: l.name.clone(),
            website: l.website.clone(),
            contact_email: l.contact_email.clone(),
            created_at: l.created_at,
            updated_at: l.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LabelMemberResponse {
    pub user_id: UserId,
    pub user_name: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

impl From<&LabelMember> for LabelMemberResponse {
    fn from(m: &LabelMember) -> Self {
        Self {
            user_id: m.user_id.clone(),
            user_name: None,
            role: m.role.as_str().to_string(),
            joined_at: m.joined_at,
        }
    }
}

/// A [`LabelMember`] enriched with the user's name, resolved by the service
/// layer via a batch lookup.
#[derive(Debug, Clone)]
pub struct LabelMemberWithDetails {
    pub member: LabelMember,
    pub user_name: Option<String>,
}

impl From<&LabelMemberWithDetails> for LabelMemberResponse {
    fn from(d: &LabelMemberWithDetails) -> Self {
        let mut res = LabelMemberResponse::from(&d.member);
        res.user_name = d.user_name.clone();
        res
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddMemberRequest {
    pub user_id: UserId,
    pub role: Option<String>,
}
