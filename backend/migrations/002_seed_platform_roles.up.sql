-- ============================================================================
-- SEED PLATFORM ROLES
-- ============================================================================
-- Pre-defined roles matching the scope system.
-- IDs are deterministic UUIDs so they're idempotent and referenceable.

INSERT INTO roles (id, name, description, scopes) VALUES
(
    '00000000-0000-4000-a000-000000000001',
    'Admin',
    'Platform administrator. Full access to all resources including label management, user administration, and system configuration.',
    ARRAY['*']
),
(
    '00000000-0000-4000-a000-000000000002',
    'Producer',
    'Movie team member. Creates and manages movies, scenes, tracks, and license requests. Can browse songs and labels.',
    ARRAY[
        'movies:*',
        'scenes:*',
        'tracks:*',
        'licenses:*',
        'songs:read',
        'labels:read'
    ]
),
(
    '00000000-0000-4000-a000-000000000003',
    'Artist',
    'Song creator and rights holder. Manages own songs, responds to license negotiations (counter-offer, accept, reject).',
    ARRAY[
        'songs:*',
        'licenses:read',
        'licenses:negotiate',
        'labels:read',
        'movies:read',
        'scenes:read',
        'tracks:read'
    ]
),
(
    '00000000-0000-4000-a000-000000000004',
    'Label Manager',
    'Label representative or owner. Manages songs under their label, responds to license negotiations on behalf of the label.',
    ARRAY[
        'songs:*',
        'licenses:read',
        'licenses:negotiate',
        'labels:read',
        'movies:read',
        'scenes:read',
        'tracks:read'
    ]
),
(
    '00000000-0000-4000-a000-000000000005',
    'Viewer',
    'Read-only access across all domain resources. Cannot create, modify, or delete anything.',
    ARRAY[
        'movies:read',
        'scenes:read',
        'tracks:read',
        'songs:read',
        'labels:read',
        'licenses:read'
    ]
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    scopes = EXCLUDED.scopes,
    updated_at = CURRENT_TIMESTAMP;
