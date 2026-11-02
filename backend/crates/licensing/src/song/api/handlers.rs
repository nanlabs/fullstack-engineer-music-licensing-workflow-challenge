use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use iam::auth::extract::Auth;
use kernel::{PageQuery, SongId};

use crate::song::{CreateSongRequest, SongFilter, UpdateSongRequest};
use crate::Container;

/// GET /songs?page=&page_size=&q=
pub async fn list_songs(
    container: web::Data<Container>,
    auth: Auth,
    page: web::Query<PageQuery>,
    filter: web::Query<SongFilter>,
) -> Result<HttpResponse, AppError> {
    let songs = container
        .song_service
        .list(&auth, filter.into_inner(), page.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(songs))
}

/// POST /songs
pub async fn create_song(
    container: web::Data<Container>,
    auth: Auth,
    body: ValidatedJson<CreateSongRequest>,
) -> Result<HttpResponse, AppError> {
    let song = container.song_service.create(&auth, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(song))
}

/// GET /songs/{id}
pub async fn get_song(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SongId>,
) -> Result<HttpResponse, AppError> {
    let song = container.song_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(song))
}

/// PUT /songs/{id}
pub async fn update_song(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SongId>,
    body: ValidatedJson<UpdateSongRequest>,
) -> Result<HttpResponse, AppError> {
    let song = container
        .song_service
        .update(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(song))
}

/// DELETE /songs/{id}
pub async fn delete_song(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<SongId>,
) -> Result<HttpResponse, AppError> {
    container.song_service.delete(&auth, id.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}
