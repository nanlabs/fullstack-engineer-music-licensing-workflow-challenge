use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::kernel::{MovieId, UserId};

// ============================================================================
// Entity
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Movie {
    pub id: MovieId,
    pub title: String,
    pub description: Option<String>,
    pub release_year: Option<i32>,
    pub director: Option<String>,
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Movie {
    pub fn new(title: String, created_by: UserId) -> Self {
        let now = Utc::now();
        Self {
            id: MovieId::new(),
            title,
            description: None,
            release_year: None,
            director: None,
            created_by,
            created_at: now,
            updated_at: now,
        }
    }
}

// ============================================================================
// Movie Membership
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum MovieRole {
    Owner,
    Supervisor,
    Editor,
    Viewer,
}

impl MovieRole {
    pub fn as_str(&self) -> &str {
        match self {
            MovieRole::Owner => "OWNER",
            MovieRole::Supervisor => "SUPERVISOR",
            MovieRole::Editor => "EDITOR",
            MovieRole::Viewer => "VIEWER",
        }
    }
}

impl TryFrom<&str> for MovieRole {
    type Error = AppError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "OWNER" => Ok(MovieRole::Owner),
            "SUPERVISOR" => Ok(MovieRole::Supervisor),
            "EDITOR" => Ok(MovieRole::Editor),
            "VIEWER" => Ok(MovieRole::Viewer),
            _ => Err(AppError::validation(format!("Invalid movie role: {value}"))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovieMember {
    pub movie_id: MovieId,
    pub user_id: UserId,
    pub role: MovieRole,
    pub joined_at: DateTime<Utc>,
}

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMovieRequest {
    pub title: String,
    pub description: Option<String>,
    pub release_year: Option<i32>,
    pub director: Option<String>,
}

impl CreateMovieRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if self.title.trim().is_empty() {
            return Err(AppError::validation("Title is required").with_detail("field", "title"));
        }
        if let Some(year) = self.release_year
            && (!(1888..=2100).contains(&year))
        {
            return Err(
                AppError::validation("Release year must be between 1888 and 2100")
                    .with_detail("field", "release_year"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMovieRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub release_year: Option<i32>,
    pub director: Option<String>,
}

impl UpdateMovieRequest {
    pub fn validate(&self) -> Result<(), AppError> {
        if let Some(ref title) = self.title
            && title.trim().is_empty()
        {
            return Err(AppError::validation("Title cannot be empty").with_detail("field", "title"));
        }
        if let Some(year) = self.release_year
            && (!(1888..=2100).contains(&year))
        {
            return Err(
                AppError::validation("Release year must be between 1888 and 2100")
                    .with_detail("field", "release_year"),
            );
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MovieResponse {
    pub id: MovieId,
    pub title: String,
    pub description: Option<String>,
    pub release_year: Option<i32>,
    pub director: Option<String>,
    pub created_by: UserId,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Movie> for MovieResponse {
    fn from(m: Movie) -> Self {
        Self {
            id: m.id,
            title: m.title,
            description: m.description,
            release_year: m.release_year,
            director: m.director,
            created_by: m.created_by,
            created_by_name: None,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

/// A [`Movie`] enriched with the creator's name, resolved by the service
/// layer via a batch lookup.
#[derive(Debug, Clone)]
pub struct MovieWithDetails {
    pub movie: Movie,
    pub created_by_name: Option<String>,
}

impl From<&MovieWithDetails> for MovieResponse {
    fn from(d: &MovieWithDetails) -> Self {
        let mut res = MovieResponse::from(d.movie.clone());
        res.created_by_name = d.created_by_name.clone();
        res
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct MovieFilter {
    pub search: Option<String>,
    pub created_by: Option<UserId>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MovieMemberResponse {
    pub user_id: UserId,
    pub user_name: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

impl From<&MovieMember> for MovieMemberResponse {
    fn from(m: &MovieMember) -> Self {
        Self {
            user_id: m.user_id.clone(),
            user_name: None,
            role: m.role.as_str().to_string(),
            joined_at: m.joined_at,
        }
    }
}

/// A [`MovieMember`] enriched with the user's name, resolved by the service
/// layer via a batch lookup.
#[derive(Debug, Clone)]
pub struct MovieMemberWithDetails {
    pub member: MovieMember,
    pub user_name: Option<String>,
}

impl From<&MovieMemberWithDetails> for MovieMemberResponse {
    fn from(d: &MovieMemberWithDetails) -> Self {
        let mut res = MovieMemberResponse::from(&d.member);
        res.user_name = d.user_name.clone();
        res
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddMovieMemberRequest {
    pub user_id: UserId,
    pub role: Option<String>,
}
