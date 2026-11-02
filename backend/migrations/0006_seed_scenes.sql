-- Development seed: scenes for two of the ACME movies. "Static" stays empty on
-- purpose so the empty-list case is visible. Fixed UUIDs keep the README
-- examples copy-pasteable; idempotent like the other seeds.

INSERT INTO scenes (id, tenant_id, movie_id, position, title, description, start_ms, end_ms)
VALUES
    -- The Last Encore
    ('55555555-5555-4555-8555-555555555551', '11111111-1111-4111-8111-111111111111',
     '44444444-4444-4444-8444-444444444441', 1, 'Opening night',
     'The pianist walks on stage for the first time in a decade.', 0, 180000),
    ('55555555-5555-4555-8555-555555555552', '11111111-1111-4111-8111-111111111111',
     '44444444-4444-4444-8444-444444444441', 2, 'Rooftop confession',
     'Two old friends talk above the city lights.', 420000, 600000),
    ('55555555-5555-4555-8555-555555555553', '11111111-1111-4111-8111-111111111111',
     '44444444-4444-4444-8444-444444444441', 3, 'Final bow',
     NULL, NULL, NULL),
    -- Midnight Frequencies
    ('55555555-5555-4555-8555-555555555554', '11111111-1111-4111-8111-111111111111',
     '44444444-4444-4444-8444-444444444442', 1, 'Signal discovered',
     'The hosts hear a voice between stations.', 0, 95000),
    ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111',
     '44444444-4444-4444-8444-444444444442', 2, 'The broadcast',
     NULL, 1800000, 2100000)
ON CONFLICT (id) DO NOTHING;
