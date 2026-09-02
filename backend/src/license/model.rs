use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::kernel::{LicenseOfferId, LicenseRequestId, TrackId, UserId};

// ============================================================================
// Events
// ============================================================================

/// Domain event emitted after a license negotiation action completes.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct LicenseEvent {
    pub license_id: LicenseRequestId,
    pub track_id: TrackId,
    pub kind: LicenseEventKind,
    pub actor: UserId,
    pub actor_name: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum LicenseEventKind {
    Submitted,
    CounterOffer,
    Accepted,
    Rejected,
    Cancelled,
}

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum LicenseStatus {
    /// Movie team is preparing the request privately.
    Draft,
    /// Sent to the rights holder. Offers/counter-offers go back and forth.
    Requested,
    /// One side accepted the other side's latest offer.
    Approved,
    /// One side rejected the other side's latest offer.
    Rejected,
    /// Movie team withdrew the request.
    Cancelled,
}

impl LicenseStatus {
    pub fn as_str(&self) -> &str {
        match self {
            LicenseStatus::Draft => "DRAFT",
            LicenseStatus::Requested => "REQUESTED",
            LicenseStatus::Approved => "APPROVED",
            LicenseStatus::Rejected => "REJECTED",
            LicenseStatus::Cancelled => "CANCELLED",
        }
    }
}

impl TryFrom<&str> for LicenseStatus {
    type Error = AppError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "DRAFT" => Ok(LicenseStatus::Draft),
            "REQUESTED" => Ok(LicenseStatus::Requested),
            "APPROVED" => Ok(LicenseStatus::Approved),
            "REJECTED" => Ok(LicenseStatus::Rejected),
            "CANCELLED" => Ok(LicenseStatus::Cancelled),
            _ => Err(AppError::validation(format!(
                "Invalid license status: {value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum NegotiationSide {
    MovieTeam,
    RightsHolder,
}

impl NegotiationSide {
    pub fn as_str(&self) -> &str {
        match self {
            NegotiationSide::MovieTeam => "MOVIE_TEAM",
            NegotiationSide::RightsHolder => "RIGHTS_HOLDER",
        }
    }

    pub fn opposite(&self) -> Self {
        match self {
            NegotiationSide::MovieTeam => NegotiationSide::RightsHolder,
            NegotiationSide::RightsHolder => NegotiationSide::MovieTeam,
        }
    }
}

impl TryFrom<&str> for NegotiationSide {
    type Error = AppError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "MOVIE_TEAM" => Ok(NegotiationSide::MovieTeam),
            "RIGHTS_HOLDER" => Ok(NegotiationSide::RightsHolder),
            _ => Err(AppError::validation(format!(
                "Invalid negotiation side: {value}"
            ))),
        }
    }
}

// ============================================================================
// Entities
// ============================================================================

/// A request to license a track. The negotiation happens through
/// [`LicenseOffer`]s exchanged between the movie team and the rights holder.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseRequest {
    pub id: LicenseRequestId,
    pub track_id: TrackId,
    pub status: LicenseStatus,
    pub requested_by: UserId,
    pub requested_at: DateTime<Utc>,
    /// Who accepted/rejected the final offer.
    pub resolved_by: Option<UserId>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl LicenseRequest {
    pub fn new(track_id: TrackId, requested_by: UserId) -> Self {
        let now = Utc::now();
        Self {
            id: LicenseRequestId::new(),
            track_id,
            status: LicenseStatus::Draft,
            requested_by,
            requested_at: now,
            resolved_by: None,
            resolved_at: None,
            rejection_reason: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// An offer (or counter-offer) in the negotiation. The latest offer is
/// the one "on the table" — only the opposite side can accept, reject,
/// or counter it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseOffer {
    pub id: LicenseOfferId,
    pub license_request_id: LicenseRequestId,
    pub offer_number: i32,
    pub side: NegotiationSide,
    pub proposed_by: UserId,
    pub license_fee: Option<f64>,
    pub currency: Option<String>,
    pub territory: Option<String>,
    pub media_rights: Option<String>,
    pub license_start: Option<DateTime<Utc>>,
    pub license_end: Option<DateTime<Utc>>,
    pub exclusive: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl LicenseOffer {
    pub fn new(
        license_request_id: LicenseRequestId,
        offer_number: i32,
        side: NegotiationSide,
        proposed_by: UserId,
    ) -> Self {
        Self {
            id: LicenseOfferId::new(),
            license_request_id,
            offer_number,
            side,
            proposed_by,
            license_fee: None,
            currency: None,
            territory: None,
            media_rights: None,
            license_start: None,
            license_end: None,
            exclusive: false,
            notes: None,
            created_at: Utc::now(),
        }
    }
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct OfferTerms {
    pub license_fee: Option<f64>,
    pub currency: Option<String>,
    pub territory: Option<String>,
    pub media_rights: Option<String>,
    pub license_start: Option<DateTime<Utc>>,
    pub license_end: Option<DateTime<Utc>>,
    pub exclusive: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateLicenseRequest {
    pub track_id: TrackId,
    #[serde(flatten)]
    #[schema(inline)]
    pub terms: OfferTerms,
}

// ============================================================================
// Responses
// ============================================================================

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct LicenseRequestResponse {
    pub id: LicenseRequestId,
    pub track_id: TrackId,
    pub status: String,
    pub requested_by: UserId,
    pub requested_by_name: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub resolved_by: Option<UserId>,
    pub resolved_by_name: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<LicenseRequest> for LicenseRequestResponse {
    fn from(lr: LicenseRequest) -> Self {
        Self {
            id: lr.id,
            track_id: lr.track_id,
            status: lr.status.as_str().to_string(),
            requested_by: lr.requested_by,
            requested_by_name: None,
            requested_at: lr.requested_at,
            resolved_by: lr.resolved_by,
            resolved_by_name: None,
            resolved_at: lr.resolved_at,
            rejection_reason: lr.rejection_reason,
            created_at: lr.created_at,
            updated_at: lr.updated_at,
        }
    }
}

/// A [`LicenseRequest`] enriched with the names of the requester and
/// resolver, resolved by the service layer via a batch lookup.
#[derive(Debug, Clone)]
pub struct LicenseRequestWithDetails {
    pub license: LicenseRequest,
    pub requested_by_name: Option<String>,
    pub resolved_by_name: Option<String>,
}

impl From<&LicenseRequestWithDetails> for LicenseRequestResponse {
    fn from(d: &LicenseRequestWithDetails) -> Self {
        let mut res = LicenseRequestResponse::from(d.license.clone());
        res.requested_by_name = d.requested_by_name.clone();
        res.resolved_by_name = d.resolved_by_name.clone();
        res
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct LicenseOfferResponse {
    pub id: LicenseOfferId,
    pub license_request_id: LicenseRequestId,
    pub offer_number: i32,
    pub side: String,
    pub proposed_by: UserId,
    pub proposed_by_name: Option<String>,
    pub license_fee: Option<f64>,
    pub currency: Option<String>,
    pub territory: Option<String>,
    pub media_rights: Option<String>,
    pub license_start: Option<DateTime<Utc>>,
    pub license_end: Option<DateTime<Utc>>,
    pub exclusive: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<LicenseOffer> for LicenseOfferResponse {
    fn from(o: LicenseOffer) -> Self {
        Self {
            id: o.id,
            license_request_id: o.license_request_id,
            offer_number: o.offer_number,
            side: o.side.as_str().to_string(),
            proposed_by: o.proposed_by,
            proposed_by_name: None,
            license_fee: o.license_fee,
            currency: o.currency,
            territory: o.territory,
            media_rights: o.media_rights,
            license_start: o.license_start,
            license_end: o.license_end,
            exclusive: o.exclusive,
            notes: o.notes,
            created_at: o.created_at,
        }
    }
}

/// A [`LicenseOffer`] enriched with the proposer's name, resolved by the
/// service layer via a batch lookup.
#[derive(Debug, Clone)]
pub struct LicenseOfferWithDetails {
    pub offer: LicenseOffer,
    pub proposed_by_name: Option<String>,
}

impl From<&LicenseOfferWithDetails> for LicenseOfferResponse {
    fn from(d: &LicenseOfferWithDetails) -> Self {
        let mut res = LicenseOfferResponse::from(d.offer.clone());
        res.proposed_by_name = d.proposed_by_name.clone();
        res
    }
}
