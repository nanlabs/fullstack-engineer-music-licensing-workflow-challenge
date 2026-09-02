use actix_web::{HttpResponse, web};
use serde::Deserialize;
use utoipa::IntoParams;

use crate::error::AppError;
use crate::iam::auth::AuthContext;
use crate::iam::scopes;
use crate::kernel::{LabelId, PaginationOptions, SongId, UserId};
use crate::track::{TrackResponse, TrackService};

use super::model::{CreateSongRequest, SongFilter, SongResponse, UpdateSongRequest};
use super::service::SongService;

// ============================================================================
// Query params
// ============================================================================

#[derive(Debug, Deserialize, IntoParams)]
pub struct FindSongsQuery {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_page_size")]
    page_size: i64,
    search: Option<String>,
    artist_id: Option<String>,
    label_id: Option<String>,
    genre: Option<String>,
}

fn default_page() -> i64 {
    1
}
fn default_page_size() -> i64 {
    20
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
struct PaginatedSongs {
    items: Vec<SongResponse>,
    pagination: crate::kernel::Page,
}

// ============================================================================
// Handlers
// ============================================================================

/// Create a song
#[utoipa::path(
    post,
    path = "/api/songs",
    tag = "Songs",
    security(("bearer_auth" = [])),
    request_body = CreateSongRequest,
    responses(
        (status = 201, description = "Song created", body = SongResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn create_song(
    auth: AuthContext,
    svc: web::Data<SongService>,
    body: web::Json<CreateSongRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_WRITE)?;
    let song = svc.create_song(body.into_inner()).await?;
    let res = SongResponse::from(&svc.to_detail(&song).await?);
    Ok(HttpResponse::Created().json(res))
}

/// List / search songs
#[utoipa::path(
    get,
    path = "/api/songs",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(FindSongsQuery),
    responses(
        (status = 200, description = "Paginated songs", body = PaginatedSongs),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn find_songs(
    auth: AuthContext,
    svc: web::Data<SongService>,
    query: web::Query<FindSongsQuery>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_READ)?;
    let q = query.into_inner();
    let opts = PaginationOptions {
        page: q.page,
        page_size: q.page_size,
    };
    let filter = SongFilter {
        search: q.search,
        artist_id: q.artist_id.map(UserId::from_string),
        label_id: q.label_id.map(LabelId::from_string),
        genre: q.genre,
    };
    let paginated = svc.find_songs(&opts, &filter).await?;
    let items: Vec<SongResponse> = svc
        .to_details(&paginated.items)
        .await?
        .iter()
        .map(SongResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "items": items,
        "pagination": paginated.pagination,
    })))
}

/// Get a song
#[utoipa::path(
    get,
    path = "/api/songs/{id}",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Song id")),
    responses(
        (status = 200, description = "Song", body = SongResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Song not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn get_song(
    auth: AuthContext,
    svc: web::Data<SongService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_READ)?;
    let song = svc
        .get_song(&SongId::from_string(path.into_inner()))
        .await?;
    let res = SongResponse::from(&svc.to_detail(&song).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Update a song
#[utoipa::path(
    put,
    path = "/api/songs/{id}",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Song id")),
    request_body = UpdateSongRequest,
    responses(
        (status = 200, description = "Song updated", body = SongResponse),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Song not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn update_song(
    auth: AuthContext,
    svc: web::Data<SongService>,
    path: web::Path<String>,
    body: web::Json<UpdateSongRequest>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_WRITE)?;
    let song = svc
        .update_song(&SongId::from_string(path.into_inner()), body.into_inner())
        .await?;
    let res = SongResponse::from(&svc.to_detail(&song).await?);
    Ok(HttpResponse::Ok().json(res))
}

/// Delete a song
#[utoipa::path(
    delete,
    path = "/api/songs/{id}",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Song id")),
    responses(
        (status = 204, description = "Song deleted"),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Song not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn delete_song(
    auth: AuthContext,
    svc: web::Data<SongService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_DELETE)?;
    svc.delete_song(&SongId::from_string(path.into_inner()))
        .await?;
    Ok(HttpResponse::NoContent().finish())
}

/// List songs by artist
#[utoipa::path(
    get,
    path = "/api/artists/{id}/songs",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Artist (user) id")),
    responses(
        (status = 200, description = "Songs by this artist", body = Vec<SongResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_by_artist(
    auth: AuthContext,
    svc: web::Data<SongService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_SONGS_READ)?;
    let songs = svc
        .list_by_artist(&UserId::from_string(path.into_inner()))
        .await?;
    let res: Vec<SongResponse> = svc
        .to_details(&songs)
        .await?
        .iter()
        .map(SongResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

/// List a song's tracks (placements across scenes)
#[utoipa::path(
    get,
    path = "/api/songs/{id}/tracks",
    tag = "Songs",
    security(("bearer_auth" = [])),
    params(("id" = String, Path, description = "Song id")),
    responses(
        (status = 200, description = "Song tracks", body = Vec<TrackResponse>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse),
        (status = 404, description = "Song not found", body = crate::error::ErrorResponse),
    )
)]
pub async fn list_song_tracks(
    auth: AuthContext,
    svc: web::Data<TrackService>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    auth.require_scope(scopes::SCOPE_TRACKS_READ)?;
    let tracks = svc
        .list_by_song(&SongId::from_string(path.into_inner()))
        .await?;
    let res: Vec<TrackResponse> = svc
        .to_details(&tracks)
        .await?
        .iter()
        .map(TrackResponse::from)
        .collect();
    Ok(HttpResponse::Ok().json(res))
}

// ============================================================================
// Route Configuration
// ============================================================================

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/songs")
            .route("", web::post().to(create_song))
            .route("", web::get().to(find_songs))
            .route("/{id}", web::get().to(get_song))
            .route("/{id}", web::put().to(update_song))
            .route("/{id}", web::delete().to(delete_song))
            .route("/{id}/tracks", web::get().to(list_song_tracks)),
    );
    cfg.route("/artists/{id}/songs", web::get().to(list_by_artist));
}
