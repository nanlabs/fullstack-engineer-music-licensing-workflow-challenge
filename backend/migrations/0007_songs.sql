-- Licensing bounded context, step 3: songs. A song is the tenant's catalogue
-- of licensable music, not a child of any movie: the same recording can be
-- placed in several scenes of several movies. Tracks (next migration) will
-- reference it with a composite (song_id, tenant_id) foreign key and
-- ON DELETE RESTRICT, so a song in use cannot be deleted; UNIQUE (id, tenant_id)
-- exists only to be that target.
--
-- Identifiers are stored normalized (upper case, no separators): ISRC is the
-- recording code (ISO 3901, 12 characters), ISWC the work code (ISO 15707,
-- "T" + 9 digits + check digit). The service validates both before insert;
-- the CHECKs mirror the shape so no other writer can store a malformed one.
--
-- The rights holder (artist, label or publisher ACME negotiates with) is a
-- counterparty, not a user of the system: plain columns, no login.

CREATE TABLE songs (
    id                  uuid PRIMARY KEY,
    tenant_id           uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    title               text NOT NULL,
    artist              text NOT NULL,
    album               text,
    release_year        integer CHECK (release_year BETWEEN 1877 AND 2100),
    duration_ms         integer CHECK (duration_ms > 0),
    isrc                text CHECK (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
    iswc                text CHECK (iswc ~ '^T[0-9]{10}$'),
    rights_holder       text NOT NULL,
    rights_holder_kind  text CHECK (rights_holder_kind IN ('artist', 'label', 'publisher')),
    rights_holder_email text,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, tenant_id)
);

-- One ISRC per tenant; songs without an ISRC do not take part.
CREATE UNIQUE INDEX songs_tenant_isrc_key ON songs (tenant_id, isrc) WHERE isrc IS NOT NULL;
CREATE INDEX songs_tenant_title_idx ON songs (tenant_id, lower(title));
