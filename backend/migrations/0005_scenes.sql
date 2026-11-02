-- Licensing bounded context, step 2: scenes. A scene is an ordered segment of
-- a movie that needs music; tracks will hang from it.
--
-- Design notes (see docs/licensing.md, "Design notes and sources"):
-- * The composite foreign key (movie_id, tenant_id) -> movies (id, tenant_id)
--   makes a scene whose tenant differs from its movie's impossible at the
--   database level, whatever the application does. movies needs the matching
--   UNIQUE (id, tenant_id) to be a valid target.
-- * position is owned by the server: appends take max + 1 and the reorder
--   endpoint rewrites 1..n in one statement. The unique constraint is deferred
--   so that statement never collides with itself half way through.
-- * The optional window (start_ms, end_ms) is all-or-nothing and ordered.

ALTER TABLE movies ADD CONSTRAINT movies_id_tenant_key UNIQUE (id, tenant_id);

CREATE TABLE scenes (
    id          uuid PRIMARY KEY,
    tenant_id   uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    movie_id    uuid NOT NULL,
    position    integer NOT NULL CHECK (position >= 1),
    title       text NOT NULL,
    description text,
    start_ms    integer CHECK (start_ms >= 0),
    end_ms      integer CHECK (end_ms >= 0),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (movie_id, tenant_id) REFERENCES movies (id, tenant_id) ON DELETE CASCADE,
    CHECK ((start_ms IS NULL) = (end_ms IS NULL)),
    CHECK (start_ms IS NULL OR start_ms < end_ms),
    UNIQUE (movie_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX scenes_movie_position_idx ON scenes (movie_id, position);
