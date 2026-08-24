//! Read-only catalog endpoints.
//!
//! DTOs are declared separately from the domain types on purpose: the wire
//! format is a contract with clients, and it should not shift because a domain
//! type gained a field.
//!
//! Every handler here declares `AuthenticatedActor`, which is what makes the
//! route require a bearer token. The catalog does not otherwise use the actor:
//! it is reference data, and there are no per-actor permissions.

use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::api::auth::AuthenticatedActor;
use crate::api::error::ApiError;
use crate::api::pagination::{Page, PageQuery};
use crate::api::AppState;
use crate::application::catalog;
use crate::domain::catalog::{Movie, Scene, Song};

#[derive(Debug, Serialize, ToSchema)]
pub struct MovieDto {
    pub id: Uuid,
    pub title: String,
    pub created_at: DateTime<Utc>,
}

impl From<Movie> for MovieDto {
    fn from(movie: Movie) -> Self {
        Self {
            id: movie.id,
            title: movie.title,
            created_at: movie.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SceneDto {
    pub id: Uuid,
    pub movie_id: Uuid,
    pub sequence_number: i32,
    pub title: String,
    pub duration_ms: i32,
}

impl From<Scene> for SceneDto {
    fn from(scene: Scene) -> Self {
        Self {
            id: scene.id,
            movie_id: scene.movie_id,
            sequence_number: scene.sequence_number,
            title: scene.title,
            duration_ms: scene.duration_ms,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SongDto {
    pub id: Uuid,
    pub title: String,
    pub artist_name: String,
}

impl From<Song> for SongDto {
    fn from(song: Song) -> Self {
        Self {
            id: song.id,
            title: song.title,
            artist_name: song.artist_name,
        }
    }
}

/// Cursor keys mirror each collection's sort key exactly. They are separate
/// types so a cursor cannot be replayed against a different collection.
#[derive(Debug, Serialize, Deserialize)]
struct MovieCursor {
    created_at: DateTime<Utc>,
    id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
struct SceneCursor {
    sequence_number: i32,
    id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
struct SongCursor {
    title: String,
    id: Uuid,
}

/// `GET /movies`, ordered by `(created_at, id)`.
#[utoipa::path(
    get,
    path = "/movies",
    tag = "Catalog",
    params(crate::api::pagination::PageQuery),
    responses(
        (status = 200, description = "Movies in creation order", body = crate::api::pagination::Page<MovieDto>),
        (status = 401, description = "Missing or invalid bearer token", body = crate::api::error::ProblemBody),
        (status = 422, description = "Invalid pagination parameters", body = crate::api::error::ProblemBody),
        (status = 503, description = "Database unavailable", body = crate::api::error::ProblemBody)
    )
)]
pub async fn list_movies(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Query(page): Query<PageQuery>,
) -> Result<Json<Page<MovieDto>>, ApiError> {
    let limit = page.limit()?;
    let after = page
        .key::<MovieCursor>()?
        .map(|cursor| (cursor.created_at, cursor.id));

    let movies = catalog::list_movies(&state.pool, after, limit).await?;

    Ok(Json(Page::from_lookahead(
        movies.into_iter().map(MovieDto::from).collect(),
        limit,
        |movie| MovieCursor {
            created_at: movie.created_at,
            id: movie.id,
        },
    )))
}

/// `GET /movies/{movie_id}/scenes`, ordered by `(sequence_number, id)` so
/// scenes arrive in story order.
#[utoipa::path(
    get,
    path = "/movies/{movie_id}/scenes",
    tag = "Catalog",
    params(
        ("movie_id" = Uuid, Path, description = "Movie identifier"),
        crate::api::pagination::PageQuery
    ),
    responses(
        (status = 200, description = "Scenes in story order", body = crate::api::pagination::Page<SceneDto>),
        (status = 401, description = "Missing or invalid bearer token", body = crate::api::error::ProblemBody),
        (status = 404, description = "Movie not found", body = crate::api::error::ProblemBody),
        (status = 422, description = "Invalid pagination parameters", body = crate::api::error::ProblemBody),
        (status = 503, description = "Database unavailable", body = crate::api::error::ProblemBody)
    )
)]
pub async fn list_scenes(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Path(movie_id): Path<Uuid>,
    Query(page): Query<PageQuery>,
) -> Result<Json<Page<SceneDto>>, ApiError> {
    let limit = page.limit()?;
    let after = page
        .key::<SceneCursor>()?
        .map(|cursor| (cursor.sequence_number, cursor.id));

    let scenes = catalog::list_scenes(&state.pool, movie_id, after, limit).await?;

    Ok(Json(Page::from_lookahead(
        scenes.into_iter().map(SceneDto::from).collect(),
        limit,
        |scene| SceneCursor {
            sequence_number: scene.sequence_number,
            id: scene.id,
        },
    )))
}

/// `GET /songs`, ordered by `(title, id)`.
#[utoipa::path(
    get,
    path = "/songs",
    tag = "Catalog",
    params(crate::api::pagination::PageQuery),
    responses(
        (status = 200, description = "Songs in title order", body = crate::api::pagination::Page<SongDto>),
        (status = 401, description = "Missing or invalid bearer token", body = crate::api::error::ProblemBody),
        (status = 422, description = "Invalid pagination parameters", body = crate::api::error::ProblemBody),
        (status = 503, description = "Database unavailable", body = crate::api::error::ProblemBody)
    )
)]
pub async fn list_songs(
    State(state): State<AppState>,
    _actor: AuthenticatedActor,
    Query(page): Query<PageQuery>,
) -> Result<Json<Page<SongDto>>, ApiError> {
    let limit = page.limit()?;
    let after = page
        .key::<SongCursor>()?
        .map(|cursor| (cursor.title, cursor.id));

    let songs = catalog::list_songs(&state.pool, after, limit).await?;

    Ok(Json(Page::from_lookahead(
        songs.into_iter().map(SongDto::from).collect(),
        limit,
        |song| SongCursor {
            title: song.title.clone(),
            id: song.id,
        },
    )))
}
