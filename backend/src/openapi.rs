use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

/// Adds the `bearer_auth` security scheme (JWT access token) referenced by
/// every protected endpoint via `security(("bearer_auth" = []))`.
struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Music Licensing Workflow API",
        version = "1.0.0",
        description = "REST API for movie/scene/song/track catalog management, label & movie \
                        team collaboration, and license negotiation between rights holders and \
                        movie productions. Real-time negotiation updates are available via \
                        Server-Sent Events at `GET /api/licenses/events`.",
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Auth", description = "Login, token refresh, and session management"),
        (name = "Movies", description = "Movies and movie team membership"),
        (name = "Scenes", description = "Scenes belonging to a movie"),
        (name = "Songs", description = "Song catalog"),
        (name = "Tracks", description = "Placement of a song into a scene"),
        (name = "Labels", description = "Record labels and their membership"),
        (name = "Licenses", description = "License request negotiation workflow"),
    ),
    paths(
        // Auth
        crate::iam::auth::api::login,
        crate::iam::auth::api::refresh,
        crate::iam::auth::api::logout,
        crate::iam::auth::api::logout_all,
        crate::iam::auth::api::me,
        crate::iam::auth::api::list_sessions,
        crate::iam::auth::api::revoke_session,
        // Movies
        crate::movie::api::create_movie,
        crate::movie::api::find_movies,
        crate::movie::api::get_movie,
        crate::movie::api::update_movie,
        crate::movie::api::delete_movie,
        crate::movie::api::my_movies,
        crate::movie::api::add_member,
        crate::movie::api::remove_member,
        crate::movie::api::list_members,
        crate::movie::api::list_movie_scenes,
        // Scenes
        crate::scene::api::create_scene,
        crate::scene::api::get_scene,
        crate::scene::api::update_scene,
        crate::scene::api::delete_scene,
        crate::scene::api::list_scene_tracks,
        // Songs
        crate::song::api::create_song,
        crate::song::api::find_songs,
        crate::song::api::get_song,
        crate::song::api::update_song,
        crate::song::api::delete_song,
        crate::song::api::list_by_artist,
        crate::song::api::list_song_tracks,
        // Tracks
        crate::track::api::create_track,
        crate::track::api::get_track,
        crate::track::api::update_track,
        crate::track::api::delete_track,
        crate::track::api::get_track_license,
        // Labels
        crate::label::api::create_label,
        crate::label::api::list_labels,
        crate::label::api::get_label,
        crate::label::api::update_label,
        crate::label::api::delete_label,
        crate::label::api::add_member,
        crate::label::api::remove_member,
        crate::label::api::list_members,
        crate::label::api::get_user_labels,
        crate::label::api::list_label_songs,
        // Licenses
        crate::license::api::create_license,
        crate::license::api::get_license,
        crate::license::api::list_offers,
        crate::license::api::revise_draft,
        crate::license::api::submit,
        crate::license::api::counter_offer,
        crate::license::api::accept,
        crate::license::api::reject,
        crate::license::api::cancel,
        crate::license::api::delete_license,
        crate::license::api::events,
    ),
    components(schemas(
        crate::error::ErrorResponse,
        crate::error::ErrorType,
        crate::kernel::Page,
        // Auth
        crate::iam::auth::api::LoginBody,
        crate::iam::auth::api::RefreshBody,
        crate::iam::auth::api::LogoutBody,
        crate::iam::auth::api::TokenResponse,
        crate::iam::auth::api::MeResponse,
        crate::iam::auth::api::SessionResponse,
        crate::iam::auth::api::MessageResponse,
        // Movies
        crate::movie::MovieRole,
        crate::movie::CreateMovieRequest,
        crate::movie::UpdateMovieRequest,
        crate::movie::MovieResponse,
        crate::movie::MovieMemberResponse,
        crate::movie::AddMovieMemberRequest,
        // Scenes
        crate::scene::CreateSceneRequest,
        crate::scene::UpdateSceneRequest,
        crate::scene::SceneResponse,
        // Songs
        crate::song::CreateSongRequest,
        crate::song::UpdateSongRequest,
        crate::song::SongResponse,
        // Tracks
        crate::track::UsageType,
        crate::track::CreateTrackRequest,
        crate::track::UpdateTrackRequest,
        crate::track::TrackResponse,
        // Labels
        crate::label::LabelRole,
        crate::label::CreateLabelRequest,
        crate::label::UpdateLabelRequest,
        crate::label::LabelResponse,
        crate::label::LabelMemberResponse,
        crate::label::AddMemberRequest,
        // Licenses
        crate::license::LicenseStatus,
        crate::license::NegotiationSide,
        crate::license::LicenseEventKind,
        crate::license::LicenseEvent,
        crate::license::OfferTerms,
        crate::license::CreateLicenseRequest,
        crate::license::LicenseRequestResponse,
        crate::license::LicenseOfferResponse,
    ))
)]
pub struct ApiDoc;
