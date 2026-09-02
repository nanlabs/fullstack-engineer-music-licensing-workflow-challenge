use sqlx::{PgPool, Row};

use crate::error::AppError;
use crate::kernel::{LabelId, UserId};
use crate::label::model::{Label, LabelMember, LabelRole};
use crate::label::port::LabelRepository;

pub struct PostgresLabelRepository {
    pool: PgPool,
}

impl PostgresLabelRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl LabelRepository for PostgresLabelRepository {
    async fn save(&self, label: &Label) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO labels (id, name, website, contact_email, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(label.id.as_str())
        .bind(&label.name)
        .bind(&label.website)
        .bind(&label.contact_email)
        .bind(label.created_at)
        .bind(label.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_by_id(&self, id: &LabelId) -> Result<Option<Label>, AppError> {
        let row = sqlx::query(
            "SELECT id, name, website, contact_email, created_at, updated_at FROM labels WHERE id = $1",
        )
        .bind(id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(label_from_row).transpose()
    }

    async fn get_by_name(&self, name: &str) -> Result<Option<Label>, AppError> {
        let row = sqlx::query(
            "SELECT id, name, website, contact_email, created_at, updated_at FROM labels WHERE name = $1",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(label_from_row).transpose()
    }

    async fn get_by_ids(&self, ids: &[LabelId]) -> Result<Vec<Label>, AppError> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let id_strs: Vec<&str> = ids.iter().map(LabelId::as_str).collect();
        let rows = sqlx::query(
            "SELECT id, name, website, contact_email, created_at, updated_at FROM labels WHERE id = ANY($1)",
        )
        .bind(&id_strs)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(label_from_row).collect()
    }

    async fn list_all(&self) -> Result<Vec<Label>, AppError> {
        let rows = sqlx::query(
            "SELECT id, name, website, contact_email, created_at, updated_at FROM labels ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(label_from_row).collect()
    }

    async fn update(&self, label: &Label) -> Result<(), AppError> {
        sqlx::query(
            r#"
            UPDATE labels SET name = $1, website = $2, contact_email = $3, updated_at = $4
            WHERE id = $5
            "#,
        )
        .bind(&label.name)
        .bind(&label.website)
        .bind(&label.contact_email)
        .bind(label.updated_at)
        .bind(label.id.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn delete(&self, id: &LabelId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM labels WHERE id = $1")
            .bind(id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    // ========================================================================
    // Membership
    // ========================================================================

    async fn add_member(&self, member: &LabelMember) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO label_members (label_id, user_id, role, joined_at)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(member.label_id.as_str())
        .bind(member.user_id.as_str())
        .bind(member.role.as_str())
        .bind(member.joined_at)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn remove_member(&self, label_id: &LabelId, user_id: &UserId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM label_members WHERE label_id = $1 AND user_id = $2")
            .bind(label_id.as_str())
            .bind(user_id.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        Ok(())
    }

    async fn get_member(
        &self,
        label_id: &LabelId,
        user_id: &UserId,
    ) -> Result<Option<LabelMember>, AppError> {
        let row = sqlx::query(
            "SELECT label_id, user_id, role, joined_at FROM label_members WHERE label_id = $1 AND user_id = $2",
        )
        .bind(label_id.as_str())
        .bind(user_id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        row.as_ref().map(member_from_row).transpose()
    }

    async fn list_members(&self, label_id: &LabelId) -> Result<Vec<LabelMember>, AppError> {
        let rows = sqlx::query(
            "SELECT label_id, user_id, role, joined_at FROM label_members WHERE label_id = $1 ORDER BY joined_at",
        )
        .bind(label_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(member_from_row).collect()
    }

    async fn get_user_labels(&self, user_id: &UserId) -> Result<Vec<Label>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT l.id, l.name, l.website, l.contact_email, l.created_at, l.updated_at
            FROM labels l
            INNER JOIN label_members lm ON l.id = lm.label_id
            WHERE lm.user_id = $1
            ORDER BY l.name
            "#,
        )
        .bind(user_id.as_str())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::internal(format!("Database error: {e}")))?;

        rows.iter().map(label_from_row).collect()
    }
}

fn label_from_row(row: &sqlx::postgres::PgRow) -> Result<Label, AppError> {
    Ok(Label {
        id: LabelId::from_string(
            row.try_get("id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'id': {e}")))?,
        ),
        name: row
            .try_get("name")
            .map_err(|e| AppError::internal(format!("Failed to read column 'name': {e}")))?,
        website: row
            .try_get("website")
            .map_err(|e| AppError::internal(format!("Failed to read column 'website': {e}")))?,
        contact_email: row.try_get("contact_email").map_err(|e| {
            AppError::internal(format!("Failed to read column 'contact_email': {e}"))
        })?,
        created_at: row
            .try_get("created_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'created_at': {e}")))?,
        updated_at: row
            .try_get("updated_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'updated_at': {e}")))?,
    })
}

fn member_from_row(row: &sqlx::postgres::PgRow) -> Result<LabelMember, AppError> {
    let role_str: String = row
        .try_get("role")
        .map_err(|e| AppError::internal(format!("Failed to read column 'role': {e}")))?;

    Ok(LabelMember {
        label_id: LabelId::from_string(
            row.try_get("label_id").map_err(|e| {
                AppError::internal(format!("Failed to read column 'label_id': {e}"))
            })?,
        ),
        user_id: UserId::from_string(
            row.try_get("user_id")
                .map_err(|e| AppError::internal(format!("Failed to read column 'user_id': {e}")))?,
        ),
        role: LabelRole::try_from(role_str.as_str())?,
        joined_at: row
            .try_get("joined_at")
            .map_err(|e| AppError::internal(format!("Failed to read column 'joined_at': {e}")))?,
    })
}
