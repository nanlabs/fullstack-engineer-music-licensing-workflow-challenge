use crate::error::AppError;
use crate::kernel::{LicenseRequestId, TrackId};

use super::model::{LicenseOffer, LicenseRequest};

#[async_trait::async_trait]
pub trait LicenseRepository: Send + Sync {
    async fn save(&self, license: &LicenseRequest) -> Result<(), AppError>;
    /// Atomically persist a license request together with its initial offer.
    /// A request must never exist without at least one offer on record.
    async fn save_with_offer(
        &self,
        license: &LicenseRequest,
        offer: &LicenseOffer,
    ) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &LicenseRequestId) -> Result<Option<LicenseRequest>, AppError>;
    async fn get_by_track(&self, track_id: &TrackId) -> Result<Option<LicenseRequest>, AppError>;
    async fn list_by_track(&self, track_id: &TrackId) -> Result<Vec<LicenseRequest>, AppError>;
    async fn update(&self, license: &LicenseRequest) -> Result<(), AppError>;
    async fn delete(&self, id: &LicenseRequestId) -> Result<(), AppError>;

    // Offers
    async fn save_offer(&self, offer: &LicenseOffer) -> Result<(), AppError>;
    async fn list_offers(
        &self,
        license_id: &LicenseRequestId,
    ) -> Result<Vec<LicenseOffer>, AppError>;
    async fn get_latest_offer(
        &self,
        license_id: &LicenseRequestId,
    ) -> Result<Option<LicenseOffer>, AppError>;
}
