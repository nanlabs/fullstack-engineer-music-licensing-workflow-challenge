//! Generated OpenAPI document and its bearer-authentication definition.

use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

use crate::api::{auth, catalog, error, health, pagination, tracks};
use crate::infrastructure::notifications::{SongSummary, TrackChangeNotification, TrackSnapshot};

/// The API contract served at `/api-docs/openapi.json` in development.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Music Licensing Workflow API",
        version = "0.1.0",
        description = "REST API and live SSE delivery for a movie music-licensing workflow. REST is authoritative; event streams provide best-effort updates while connected."
    ),
    paths(
        health::live,
        health::ready,
        auth::issue_dev_token,
        catalog::list_movies,
        catalog::list_scenes,
        catalog::list_songs,
        tracks::create_track,
        tracks::get_track,
        tracks::revise_track,
        tracks::set_licensing_state,
        tracks::list_scene_tracks,
        tracks::list_movie_tracks,
        tracks::list_track_history,
        crate::api::events::stream_movie_events,
        crate::api::events::stream_scene_events
    ),
    components(schemas(
        auth::DevTokenRequest,
        auth::DevTokenResponse,
        catalog::MovieDto,
        catalog::SceneDto,
        catalog::SongDto,
        error::ProblemBody,
        health::LivenessBody,
        health::ReadinessBody,
        pagination::Page<catalog::MovieDto>,
        pagination::Page<catalog::SceneDto>,
        pagination::Page<catalog::SongDto>,
        pagination::Page<tracks::TrackWithSongDto>,
        pagination::Page<tracks::TrackEventDto>,
        tracks::CreateTrackRequest,
        tracks::ReviseTrackRequest,
        tracks::SetLicensingStateRequest,
        tracks::SongSummaryDto,
        tracks::TrackDto,
        tracks::TrackEventDto,
        tracks::TrackWithSongDto,
        SongSummary,
        TrackChangeNotification,
        TrackSnapshot
    )),
    modifiers(&SecurityAddon),
    security(("bearer_auth" = [])),
    tags(
        (name = "Health", description = "Public process and dependency probes"),
        (name = "Authentication", description = "Development-only token issuance"),
        (name = "Catalog", description = "Read-only movies, scenes, and songs"),
        (name = "Tracks", description = "Track definitions, licensing workflow, lists, and history"),
        (name = "Event streams", description = "Best-effort live Server-Sent Events without replay")
    )
)]
pub struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .description(Some(
                            "Token issued by the development endpoint or a compatible identity provider.",
                        ))
                        .build(),
                ),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_covers_every_application_route_and_bearer_authentication() {
        let document = serde_json::to_value(ApiDoc::openapi()).expect("OpenAPI is serializable");
        let paths = document["paths"].as_object().expect("paths object");
        let operations = paths
            .values()
            .map(|path| path.as_object().expect("path item").len())
            .sum::<usize>();

        assert_eq!(
            paths.len(),
            14,
            "every mounted application path is documented"
        );
        assert_eq!(operations, 15, "every HTTP operation is documented");
        assert_eq!(
            document["components"]["securitySchemes"]["bearer_auth"]["scheme"],
            "bearer"
        );
    }
}
