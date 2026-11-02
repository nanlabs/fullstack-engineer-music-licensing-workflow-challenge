-- Development seed: the ACME BROS PICTURES tenant with an admin and a licensing manager.
-- Idempotent so the migration can run on an existing database. Fixed UUIDs make the
-- README examples copy-pasteable.

INSERT INTO tenants (id, slug, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'acme', 'ACME BROS PICTURES')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, status, scopes, email_verified, otp_enabled)
VALUES
    ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111',
     'admin@acme.test', 'ACME Admin', 'active', '{*}', true, true),
    ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
     'licensing@acme.test', 'Licensing Manager', 'active', '{}', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, tenant_id, name, description, scopes)
VALUES ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111',
        'licensing-manager', 'Manages movies, scenes, tracks and their licenses',
        '{movies:*,licenses:*}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
VALUES ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333331')
ON CONFLICT DO NOTHING;
