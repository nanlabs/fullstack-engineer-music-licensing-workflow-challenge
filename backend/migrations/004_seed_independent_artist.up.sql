-- ============================================================================
-- SEED INDEPENDENT ARTIST
-- ============================================================================
-- An artist with no label membership. Exercises the "independent artist"
-- rights-holder flow: they negotiate licenses for their own songs directly
-- (see license service is_rights_holder: song without label -> artist holds
-- the rights).
-- Password: abraxas12345 (same bcrypt hash as the other seed users).

INSERT INTO users (id, email, name, password_hash, status, email_verified) VALUES
(
    '00000000-0000-4000-b000-000000000007',
    'iris@solo.dev',
    'Iris Vega',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    status = EXCLUDED.status,
    email_verified = EXCLUDED.email_verified,
    updated_at = CURRENT_TIMESTAMP;

-- Iris Vega -> Artist (no label membership on purpose)
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000007', '00000000-0000-4000-a000-000000000003')
ON CONFLICT DO NOTHING;

-- One independent song (label_id NULL) so her catalog isn't empty.
INSERT INTO songs (id, title, artist_id, label_id, album, duration_seconds, genre) VALUES
(
    '00000000-0000-4000-d000-000000000001',
    'Midnight Drive',
    '00000000-0000-4000-b000-000000000007',
    NULL,
    'Solo Sessions',
    212,
    'Synthwave'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    artist_id = EXCLUDED.artist_id,
    label_id = EXCLUDED.label_id,
    album = EXCLUDED.album,
    duration_seconds = EXCLUDED.duration_seconds,
    genre = EXCLUDED.genre,
    updated_at = CURRENT_TIMESTAMP;
