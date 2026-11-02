-- Licensing bounded context, step 4: tracks. A track is a cue: a song placed
-- in a scene with the start and end of its use on the movie timeline and a
-- usage type. It is the unit that gets licensed; the license workflow hangs
-- from it in the next step.
--
-- Design notes (see docs/licensing.md, "Design notes and sources"):
-- * Two composite foreign keys with different semantics. The scene *owns*
--   its tracks (ON DELETE CASCADE); the song is only *referenced*, so a song
--   that is still placed cannot be deleted (ON DELETE RESTRICT, surfaced as
--   409 SONG_IN_USE). Both carry tenant_id, so a track whose tenant differs
--   from its scene's or its song's is impossible at the database level.
--   scenes needs the matching UNIQUE (id, tenant_id) to be a valid target
--   (songs has had one since 0007).
-- * Timecodes are milliseconds on the movie timeline, as in cue sheets and
--   DDEX cues. The rule "a track falls inside its scene's window" spans two
--   tables, so the services enforce it from both sides; the CHECKs below
--   mirror the single-row rules only.
-- * Tracks may overlap (crossfades, score under source music): there is no
--   exclusion constraint on purpose.

ALTER TABLE scenes ADD CONSTRAINT scenes_id_tenant_key UNIQUE (id, tenant_id);

CREATE TABLE tracks (
    id         uuid PRIMARY KEY,
    tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    scene_id   uuid NOT NULL,
    song_id    uuid NOT NULL,
    start_ms   integer NOT NULL CHECK (start_ms >= 0),
    end_ms     integer NOT NULL,
    usage      text NOT NULL CHECK (usage IN ('background', 'featured')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tracks_scene_fkey FOREIGN KEY (scene_id, tenant_id)
        REFERENCES scenes (id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT tracks_song_fkey FOREIGN KEY (song_id, tenant_id)
        REFERENCES songs (id, tenant_id) ON DELETE RESTRICT,
    CHECK (start_ms < end_ms)
);

CREATE INDEX tracks_scene_start_idx ON tracks (scene_id, start_ms);
CREATE INDEX tracks_song_idx ON tracks (song_id);
