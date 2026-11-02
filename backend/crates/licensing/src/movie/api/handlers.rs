use actix_web::{web, HttpResponse};
use errx::{AppError, ValidatedJson};
use iam::auth::extract::Auth;
use kernel::{MovieId, PageQuery};

use crate::movie::{CreateMovieRequest, MovieFilter, UpdateMovieRequest};
use crate::Container;

/// GET /movies?page=&page_size=&q=&status=
///
/// Two `Query` extractors read the same query string: serde ignores the
/// fields it does not know, which keeps `PageQuery` reusable across modules.
pub async fn list_movies(
    container: web::Data<Container>,
    auth: Auth,
    page: web::Query<PageQuery>,
    filter: web::Query<MovieFilter>,
) -> Result<HttpResponse, AppError> {
    let movies = container
        .movie_service
        .list(&auth, filter.into_inner(), page.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(movies))
}

/// POST /movies
pub async fn create_movie(
    container: web::Data<Container>,
    auth: Auth,
    body: ValidatedJson<CreateMovieRequest>,
) -> Result<HttpResponse, AppError> {
    let movie = container.movie_service.create(&auth, body.into_inner()).await?;
    Ok(HttpResponse::Created().json(movie))
}

/// GET /movies/{id}
pub async fn get_movie(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<MovieId>,
) -> Result<HttpResponse, AppError> {
    let movie = container.movie_service.get(&auth, id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(movie))
}

/// PUT /movies/{id}
pub async fn update_movie(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<MovieId>,
    body: ValidatedJson<UpdateMovieRequest>,
) -> Result<HttpResponse, AppError> {
    let movie = container
        .movie_service
        .update(&auth, id.into_inner(), body.into_inner())
        .await?;
    Ok(HttpResponse::Ok().json(movie))
}

/// DELETE /movies/{id}
pub async fn delete_movie(
    container: web::Data<Container>,
    auth: Auth,
    id: web::Path<MovieId>,
) -> Result<HttpResponse, AppError> {
    container.movie_service.delete(&auth, id.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}
