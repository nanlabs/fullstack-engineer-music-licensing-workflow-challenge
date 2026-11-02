-- Development seed: three ACME BROS PICTURES movies in different stages so the
-- catalogue is not empty on first start. Fixed UUIDs keep the README examples
-- copy-pasteable; idempotent like the IAM seed.

INSERT INTO movies (id, tenant_id, title, synopsis, release_year, status)
VALUES
    ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111',
     'The Last Encore',
     'A retired jazz pianist is pulled back on stage for one final tour.',
     2026, 'in_production'),
    ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111',
     'Midnight Frequencies',
     'Two late-night radio hosts uncover a signal that predicts the news.',
     2024, 'released'),
    ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111',
     'Static',
     NULL,
     NULL, 'draft')
ON CONFLICT (id) DO NOTHING;
