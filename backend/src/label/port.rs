use std::collections::{HashMap, HashSet};

use crate::error::AppError;
use crate::kernel::{LabelId, UserId};

use super::model::{Label, LabelMember};

#[async_trait::async_trait]
pub trait LabelRepository: Send + Sync {
    async fn save(&self, label: &Label) -> Result<(), AppError>;
    async fn get_by_id(&self, id: &LabelId) -> Result<Option<Label>, AppError>;
    /// Batch lookup, used to resolve display names for a set of label ids.
    async fn get_by_ids(&self, ids: &[LabelId]) -> Result<Vec<Label>, AppError>;
    async fn get_by_name(&self, name: &str) -> Result<Option<Label>, AppError>;
    async fn list_all(&self) -> Result<Vec<Label>, AppError>;
    async fn update(&self, label: &Label) -> Result<(), AppError>;
    async fn delete(&self, id: &LabelId) -> Result<(), AppError>;

    // Membership
    async fn add_member(&self, member: &LabelMember) -> Result<(), AppError>;
    async fn remove_member(&self, label_id: &LabelId, user_id: &UserId) -> Result<(), AppError>;
    async fn get_member(
        &self,
        label_id: &LabelId,
        user_id: &UserId,
    ) -> Result<Option<LabelMember>, AppError>;
    async fn list_members(&self, label_id: &LabelId) -> Result<Vec<LabelMember>, AppError>;
    async fn get_user_labels(&self, user_id: &UserId) -> Result<Vec<Label>, AppError>;
}

/// Adds name-resolution helpers on top of any `LabelRepository`, mirroring
/// `UserRepositoryExt`, so services can enrich responses with `label_name`.
#[async_trait::async_trait]
pub trait LabelRepositoryExt {
    async fn resolve_names(
        &self,
        ids: impl IntoIterator<Item = LabelId> + Send,
    ) -> Result<HashMap<LabelId, String>, AppError>;
}

#[async_trait::async_trait]
impl LabelRepositoryExt for dyn LabelRepository + '_ {
    async fn resolve_names(
        &self,
        ids: impl IntoIterator<Item = LabelId> + Send,
    ) -> Result<HashMap<LabelId, String>, AppError> {
        let unique_ids: Vec<LabelId> = ids
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let labels = self.get_by_ids(&unique_ids).await?;
        Ok(labels.into_iter().map(|l| (l.id, l.name)).collect())
    }
}
