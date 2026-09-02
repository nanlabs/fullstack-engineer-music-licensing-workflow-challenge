-- ============================================================================
-- SEED PLATFORM USERS
-- ============================================================================
-- Test users matching the frontend mock-data personas.
-- All passwords: abraxas12345 (bcrypt hash below).
-- User IDs are deterministic so the frontend can reference them.

INSERT INTO users (id, email, name, password_hash, status, email_verified) VALUES
(
    '00000000-0000-4000-b000-000000000001',
    'casey@studio.dev',
    'Casey Reyes',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
),
(
    '00000000-0000-4000-b000-000000000002',
    'jordan@studio.dev',
    'Jordan Blake',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
),
(
    '00000000-0000-4000-b000-000000000003',
    'nova@indie.dev',
    'Nova Chen',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
),
(
    '00000000-0000-4000-b000-000000000004',
    'priya@wavelabel.dev',
    'Priya Anand',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
),
(
    '00000000-0000-4000-b000-000000000005',
    'mateo@wavelabel.dev',
    'Mateo Ruiz',
    '$2b$12$/uotUvHiJ5iUk2Sw8CVbseSdyMw7BQ13rvLmi5J/yrzXC7sk7pKoa',
    'ACTIVE',
    TRUE
),
(
    '00000000-0000-4000-b000-000000000006',
    'sam@studio.dev',
    'Sam Okafor',
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

-- ============================================================================
-- ASSIGN PLATFORM ROLES
-- ============================================================================
-- Role IDs from 002_seed_platform_roles.up.sql:
--   Admin:         00000000-0000-4000-a000-000000000001
--   Producer:      00000000-0000-4000-a000-000000000002
--   Artist:        00000000-0000-4000-a000-000000000003
--   Label Manager: 00000000-0000-4000-a000-000000000004
--   Viewer:        00000000-0000-4000-a000-000000000005

-- Casey Reyes -> Producer (movie supervisor)
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- Jordan Blake -> Producer
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- Nova Chen -> Artist
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000003')
ON CONFLICT DO NOTHING;

-- Priya Anand -> Label Manager
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004')
ON CONFLICT DO NOTHING;

-- Mateo Ruiz -> Label Manager
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000004')
ON CONFLICT DO NOTHING;

-- Sam Okafor -> Admin
INSERT INTO user_roles (user_id, role_id) VALUES
    ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED LABELS
-- ============================================================================

INSERT INTO labels (id, name, website, contact_email) VALUES
(
    '00000000-0000-4000-c000-000000000001',
    'Wave Records',
    'https://waverecords.example',
    'licensing@waverecords.example'
),
(
    '00000000-0000-4000-c000-000000000002',
    'Indie Frequency',
    NULL,
    'hello@indiefrequency.example'
)
ON CONFLICT (name) DO UPDATE SET
    website = EXCLUDED.website,
    contact_email = EXCLUDED.contact_email,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEED LABEL MEMBERS
-- ============================================================================

-- Priya Anand -> Wave Records OWNER
INSERT INTO label_members (label_id, user_id, role) VALUES
    ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000004', 'OWNER')
ON CONFLICT DO NOTHING;

-- Mateo Ruiz -> Wave Records REP
INSERT INTO label_members (label_id, user_id, role) VALUES
    ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000005', 'REP')
ON CONFLICT DO NOTHING;

-- Nova Chen -> Wave Records ARTIST
INSERT INTO label_members (label_id, user_id, role) VALUES
    ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000003', 'ARTIST')
ON CONFLICT DO NOTHING;
