//! Scenes: ordered segments of a movie that need music.
//!
//! Same shape as `movie`. A scene belongs to exactly one movie and one
//! tenant; `SceneRepository::list_by_movie(tenant_id, movie_id)` is the main
//! query. Validate that the referenced movie belongs to the same tenant in
//! the service, never in the handler.
