-- Licensing bounded context, step 5: the license workflow. Every track owns
-- exactly one license (the negotiation with the rights holder) that moves
-- through pending -> requested -> negotiating -> approved | rejected, with
-- rejected -> negotiating (reopen) and approved -> expired. Each applied
-- transition is appended to license_events.
--
-- Design notes (see docs/licensing.md, "Design notes and sources"):
-- * One row per track with a shared primary key (licenses.track_id is both
--   the PK and the FK): the license is born with the track and dies with it
--   (ON DELETE CASCADE). The composite FK keeps tenant_id consistent, which
--   needs the matching UNIQUE (id, tenant_id) on tracks.
-- * The current state is a mutable projection; the history is the
--   append-only license_events. "version" counts applied events and is the
--   optimistic-concurrency guard: a transition updates WHERE version = the
--   value it read and inserts the event with seq = version + 1; the UNIQUE
--   on (track_id, seq) is the safety net.
-- * expires_at is the end of the agreed term, set by "approve"; the expiry
--   sweep moves approved licenses past it to expired (source = system).
-- * actor_user_id is the ACME user who recorded the event (NULL for the
--   sweep); actor_name is a snapshot so the history reads the same even if
--   the account is renamed later. IAM never deletes users, SET NULL is a
--   belt-and-braces choice.
-- * The backfill at the end gives every existing track a pending license, so
--   the invariant "every track has a license" also holds for databases that
--   already had tracks.

ALTER TABLE tracks ADD CONSTRAINT tracks_id_tenant_key UNIQUE (id, tenant_id);

CREATE TABLE licenses (
    track_id   uuid PRIMARY KEY,
    tenant_id  uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    state      text NOT NULL DEFAULT 'pending'
               CHECK (state IN ('pending', 'requested', 'negotiating', 'approved', 'rejected', 'expired')),
    version    integer NOT NULL DEFAULT 0 CHECK (version >= 0),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT licenses_track_fkey FOREIGN KEY (track_id, tenant_id)
        REFERENCES tracks (id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT licenses_track_tenant_key UNIQUE (track_id, tenant_id),
    CHECK (expires_at IS NULL OR state IN ('approved', 'expired'))
);

CREATE INDEX licenses_expiry_idx ON licenses (expires_at) WHERE state = 'approved';

CREATE TABLE license_events (
    id            uuid PRIMARY KEY,
    tenant_id     uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    track_id      uuid NOT NULL,
    seq           integer NOT NULL CHECK (seq > 0),
    event         text NOT NULL
                  CHECK (event IN ('request', 'start_negotiation', 'approve', 'reject', 'reopen', 'expire')),
    from_state    text NOT NULL,
    to_state      text NOT NULL,
    source        text NOT NULL CHECK (source IN ('acme', 'rights_holder', 'system')),
    actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    actor_name    text,
    note          text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT license_events_license_fkey FOREIGN KEY (track_id, tenant_id)
        REFERENCES licenses (track_id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT license_events_seq_key UNIQUE (track_id, seq)
);

INSERT INTO licenses (track_id, tenant_id)
SELECT id, tenant_id FROM tracks
ON CONFLICT DO NOTHING;
