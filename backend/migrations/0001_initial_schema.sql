-- Initial schema: catalog reference data, tracks, and the immutable event log.
--
-- Enum-like columns are stored as snake_case text guarded by CHECK constraints
-- rather than PostgreSQL enum types, so that adding a value later is a plain
-- constraint change instead of a type migration.

CREATE TABLE movies (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT movies_title_length CHECK (char_length(title) BETWEEN 1 AND 255)
);

-- Keyset pagination for GET /movies.
CREATE INDEX movies_created_at_id_idx ON movies (created_at, id);

CREATE TABLE scenes (
    id uuid PRIMARY KEY,
    movie_id uuid NOT NULL REFERENCES movies (id),
    sequence_number integer NOT NULL,
    title text NOT NULL,
    duration_ms integer NOT NULL,
    CONSTRAINT scenes_title_length CHECK (char_length(title) BETWEEN 1 AND 255),
    CONSTRAINT scenes_sequence_number_positive CHECK (sequence_number > 0),
    CONSTRAINT scenes_duration_positive CHECK (duration_ms > 0),
    CONSTRAINT scenes_sequence_unique_per_movie UNIQUE (movie_id, sequence_number)
);

-- Story-order pagination for GET /movies/{movie_id}/scenes.
CREATE INDEX scenes_movie_sequence_id_idx ON scenes (movie_id, sequence_number, id);

-- Scene lookup by movie for GET /movies/{movie_id}/tracks.
CREATE INDEX scenes_movie_id_idx ON scenes (movie_id, id);

CREATE TABLE songs (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    artist_name text NOT NULL,
    CONSTRAINT songs_title_length CHECK (char_length(title) BETWEEN 1 AND 255),
    CONSTRAINT songs_artist_name_length CHECK (char_length(artist_name) BETWEEN 1 AND 255)
);

-- Title-order pagination for GET /songs.
CREATE INDEX songs_title_id_idx ON songs (title, id);

CREATE TABLE tracks (
    id uuid PRIMARY KEY,
    scene_id uuid NOT NULL REFERENCES scenes (id),
    song_id uuid NOT NULL REFERENCES songs (id),
    scene_start_ms integer NOT NULL,
    scene_end_ms integer NOT NULL,
    licensing_state text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    -- The upper bound, scene_end_ms <= scenes.duration_ms, is a cross-table
    -- check performed by the application after locking the scene row in the
    -- same transaction; it cannot be expressed as a row-local CHECK.
    CONSTRAINT tracks_interval_ordered CHECK (scene_start_ms >= 0 AND scene_start_ms < scene_end_ms),
    CONSTRAINT tracks_version_positive CHECK (version >= 1),
    CONSTRAINT tracks_licensing_state_valid CHECK (
        licensing_state IN ('pending', 'in_negotiation', 'licensed', 'rejected', 'cancelled')
    )
);

-- Duplicate (scene_id, song_id, interval) rows are intentionally allowed: they
-- may represent distinct intended uses of the same song in the same scene.

-- Keyset pagination for GET /scenes/{scene_id}/tracks.
CREATE INDEX tracks_scene_created_at_id_idx ON tracks (scene_id, created_at, id);

-- Keyset pagination for movie-wide and unscoped track listings.
CREATE INDEX tracks_created_at_id_idx ON tracks (created_at, id);

-- Reverse lookup from a song to its uses.
CREATE INDEX tracks_song_id_idx ON tracks (song_id);

CREATE TABLE track_events (
    -- Globally increasing; also the history pagination cursor.
    id bigserial PRIMARY KEY,
    track_id uuid NOT NULL REFERENCES tracks (id),
    movie_id uuid NOT NULL REFERENCES movies (id),
    track_version integer NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    actor_id uuid NOT NULL,
    actor_name text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    -- Populated only by scene relocations, which are delivered to both the
    -- previous and the new scene stream.
    previous_scene_id uuid REFERENCES scenes (id),
    new_scene_id uuid REFERENCES scenes (id),
    CONSTRAINT track_events_track_version_positive CHECK (track_version >= 1),
    CONSTRAINT track_events_actor_name_length CHECK (char_length(actor_name) BETWEEN 1 AND 64),
    CONSTRAINT track_events_type_valid CHECK (
        event_type IN ('track_created', 'track_revised', 'licensing_state_changed')
    ),
    CONSTRAINT track_events_payload_versioned CHECK (payload ? 'payload_schema_version')
);

-- Per-track history ordering and pagination.
CREATE INDEX track_events_track_id_id_idx ON track_events (track_id, id);
