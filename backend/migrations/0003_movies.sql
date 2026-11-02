-- Licensing bounded context, step 1: movies. A movie is the catalogue entry
-- that owns scenes. Tenant-owned like every IAM row; no uniqueness on the
-- title because remakes exist.

CREATE TABLE movies (
    id           uuid PRIMARY KEY,
    tenant_id    uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    title        text NOT NULL,
    synopsis     text,
    release_year integer CHECK (release_year BETWEEN 1888 AND 2100),
    status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'in_production', 'released', 'archived')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX movies_tenant_title_idx ON movies (tenant_id, lower(title));
