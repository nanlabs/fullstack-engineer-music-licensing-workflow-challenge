-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,

    -- Auth: password OR OAuth (at least one set)
    password_hash VARCHAR(255),
    oauth_provider VARCHAR(50),
    oauth_provider_id VARCHAR(255),

    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_user_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING')),
    CONSTRAINT chk_oauth_provider CHECK (oauth_provider IS NULL OR oauth_provider IN ('GOOGLE', 'MICROSOFT')),
    CONSTRAINT chk_has_auth_method CHECK (password_hash IS NOT NULL OR (oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_oauth_provider ON users(oauth_provider, oauth_provider_id);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Application users';

-- ============================================================================
-- ROLES
-- ============================================================================

CREATE TABLE roles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_roles_name UNIQUE (name)
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_scopes ON roles USING GIN(scopes);

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE roles IS 'Named collections of scopes that can be assigned to users (like AWS IAM roles)';
COMMENT ON COLUMN roles.scopes IS 'Array of permission scopes granted by this role';

-- ============================================================================
-- USER-ROLE ASSIGNMENTS
-- ============================================================================

CREATE TABLE user_roles (
    user_id VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

COMMENT ON TABLE user_roles IS 'Assignment of roles to users';

-- ============================================================================
-- USER SESSIONS — represents a login from a specific device/browser
-- ============================================================================

CREATE TABLE user_sessions (
    id          VARCHAR(255) PRIMARY KEY,
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address  TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT '',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

COMMENT ON TABLE user_sessions IS 'Tracks active login sessions per device/browser';

-- ============================================================================
-- REFRESH TOKENS — belongs to a session, rotates within it
-- ============================================================================

CREATE TABLE refresh_tokens (
    id          VARCHAR(255) PRIMARY KEY,
    token       TEXT NOT NULL,
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id  VARCHAR(255) NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens, linked to a session for token rotation';

-- ============================================================================
-- LABELS
-- ============================================================================

CREATE TABLE labels (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website TEXT,
    contact_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_labels_name UNIQUE (name)
);

CREATE INDEX idx_labels_name ON labels(name);

CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE labels IS 'Music labels / record companies';

-- ============================================================================
-- LABEL MEMBERS
-- ============================================================================

CREATE TABLE label_members (
    label_id VARCHAR(255) NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    user_id  VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role     VARCHAR(50) NOT NULL DEFAULT 'REP',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (label_id, user_id),
    CONSTRAINT chk_label_role CHECK (role IN ('OWNER', 'REP', 'ARTIST'))
);

CREATE INDEX idx_label_members_label_id ON label_members(label_id);
CREATE INDEX idx_label_members_user_id ON label_members(user_id);

COMMENT ON TABLE label_members IS 'Users belonging to a label (owners, reps, artists)';

-- ============================================================================
-- SONGS
-- ============================================================================

CREATE TABLE songs (
    id               VARCHAR(255) PRIMARY KEY,
    title            VARCHAR(500) NOT NULL,
    artist_id        VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label_id         VARCHAR(255) REFERENCES labels(id) ON DELETE SET NULL,
    album            VARCHAR(500),
    duration_seconds INTEGER NOT NULL,
    genre            VARCHAR(100),
    isrc             VARCHAR(20),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_song_duration CHECK (duration_seconds > 0)
);

CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_label_id ON songs(label_id);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_genre ON songs(genre);

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE songs IS 'Musical works available for licensing';

-- ============================================================================
-- MOVIES
-- ============================================================================

CREATE TABLE movies (
    id           VARCHAR(255) PRIMARY KEY,
    title        VARCHAR(500) NOT NULL,
    description  TEXT,
    release_year INTEGER,
    director     VARCHAR(255),
    created_by   VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_movie_release_year CHECK (release_year IS NULL OR (release_year >= 1888 AND release_year <= 2100))
);

CREATE INDEX idx_movies_created_by ON movies(created_by);
CREATE INDEX idx_movies_title ON movies(title);

CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON movies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE movies IS 'Movies that require music licensing for their scenes';

-- ============================================================================
-- MOVIE MEMBERS
-- ============================================================================

CREATE TABLE movie_members (
    movie_id    VARCHAR(255) NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (movie_id, user_id),
    CONSTRAINT chk_movie_member_role CHECK (role IN ('OWNER', 'SUPERVISOR', 'EDITOR', 'VIEWER'))
);

CREATE INDEX idx_movie_members_user_id ON movie_members(user_id);

COMMENT ON TABLE movie_members IS 'Users who collaborate on a movie project';

-- ============================================================================
-- SCENES
-- ============================================================================

CREATE TABLE scenes (
    id           VARCHAR(255) PRIMARY KEY,
    movie_id     VARCHAR(255) NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    title        VARCHAR(500) NOT NULL,
    scene_number INTEGER NOT NULL,
    description  TEXT,
    start_time   INTEGER NOT NULL,
    end_time     INTEGER NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_scene_times CHECK (end_time > start_time),
    CONSTRAINT chk_scene_start_positive CHECK (start_time >= 0),
    CONSTRAINT chk_scene_number_positive CHECK (scene_number >= 1)
);

CREATE INDEX idx_scenes_movie_id ON scenes(movie_id);

CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scenes IS 'Segments of a movie where music tracks are placed';

-- ============================================================================
-- TRACKS  (song placement in a scene)
-- ============================================================================

CREATE TABLE tracks (
    id                 VARCHAR(255) PRIMARY KEY,
    scene_id           VARCHAR(255) NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    song_id            VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    usage_type         VARCHAR(50) NOT NULL,
    start_time_seconds INTEGER NOT NULL,
    end_time_seconds   INTEGER NOT NULL,
    created_by         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_track_scene_song UNIQUE (scene_id, song_id),
    CONSTRAINT chk_track_usage_type CHECK (usage_type IN ('BACKGROUND', 'FEATURED', 'CREDITS', 'TRAILER')),
    CONSTRAINT chk_track_start_positive CHECK (start_time_seconds >= 0),
    CONSTRAINT chk_track_times CHECK (end_time_seconds > start_time_seconds)
);

CREATE INDEX idx_tracks_scene_id ON tracks(scene_id);
CREATE INDEX idx_tracks_song_id ON tracks(song_id);

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tracks IS 'A song placement within a movie scene';

-- ============================================================================
-- LICENSE REQUESTS  (workflow for licensing a track)
-- ============================================================================

CREATE TABLE license_requests (
    id               VARCHAR(255) PRIMARY KEY,
    track_id         VARCHAR(255) NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    status           VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    requested_by     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by      VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_license_status CHECK (status IN ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX idx_license_requests_track_id ON license_requests(track_id);
CREATE INDEX idx_license_requests_status ON license_requests(status);
CREATE INDEX idx_license_requests_requested_by ON license_requests(requested_by);

CREATE TRIGGER update_license_requests_updated_at BEFORE UPDATE ON license_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE license_requests IS 'License workflow requests for song placements in scenes';

-- ============================================================================
-- LICENSE OFFERS  (offer / counter-offer negotiation history)
-- ============================================================================

CREATE TABLE license_offers (
    id                  VARCHAR(255) PRIMARY KEY,
    license_request_id  VARCHAR(255) NOT NULL REFERENCES license_requests(id) ON DELETE CASCADE,
    offer_number        INTEGER NOT NULL,
    side                VARCHAR(50) NOT NULL,
    proposed_by         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_fee         DOUBLE PRECISION,
    currency            VARCHAR(10),
    territory           TEXT,
    media_rights        TEXT,
    license_start       TIMESTAMPTZ,
    license_end         TIMESTAMPTZ,
    exclusive           BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_offer_side CHECK (side IN ('MOVIE_TEAM', 'RIGHTS_HOLDER')),
    CONSTRAINT uq_license_offer UNIQUE (license_request_id, offer_number)
);

CREATE INDEX idx_license_offers_request_id ON license_offers(license_request_id);

COMMENT ON TABLE license_offers IS 'Offer/counter-offer negotiation history for license requests';
