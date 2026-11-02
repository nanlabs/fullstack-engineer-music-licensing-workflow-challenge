-- Development seed: license states for the four seeded tracks, so the lists
-- show the workflow at different points. "Final bow" stays pending so the
-- README walkthrough can run request -> reject -> reopen -> approve on it.
-- The backfill in 0011 created every license as pending/version 0; the
-- updates below apply once (version = 0) and the events are keyed by fixed
-- ids, so the migration is idempotent like the other seeds. The actor is the
-- seeded licensing manager (0002).

-- The Last Encore / Opening night: Velvet Static, approved for five years.
UPDATE licenses
SET state = 'approved', version = 3, expires_at = '2031-12-31T23:59:59Z', updated_at = '2026-09-12T15:00:00Z'
WHERE track_id = '77777777-7777-4777-8777-777777777771' AND version = 0;

-- The Last Encore / Rooftop confession: Last Call at the Blue Room, in negotiation.
UPDATE licenses
SET state = 'negotiating', version = 2, updated_at = '2026-10-20T11:00:00Z'
WHERE track_id = '77777777-7777-4777-8777-777777777772' AND version = 0;

-- Midnight Frequencies / Signal discovered: Frequency Drift, a one-year term that ended.
UPDATE licenses
SET state = 'expired', version = 4, expires_at = '2026-10-15T00:00:00Z', updated_at = '2026-10-15T00:05:00Z'
WHERE track_id = '77777777-7777-4777-8777-777777777774' AND version = 0;

INSERT INTO license_events (id, tenant_id, track_id, seq, event, from_state, to_state, source, actor_user_id, actor_name, note, created_at)
VALUES
    -- Opening night
    ('88888888-8888-4888-8888-888888888801', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777771', 1, 'request', 'pending', 'requested', 'acme',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Quote request sent to Harbor Lane Records: background use, 1:20, worldwide, all media, five years.',
     '2026-09-01T10:00:00Z'),
    ('88888888-8888-4888-8888-888888888802', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777771', 2, 'start_negotiation', 'requested', 'negotiating', 'rights_holder',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Harbor Lane quoted and asks for most-favoured-nations terms with the publisher.',
     '2026-09-05T09:30:00Z'),
    ('88888888-8888-4888-8888-888888888803', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777771', 3, 'approve', 'negotiating', 'approved', 'rights_holder',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Fee agreed: five years, worldwide, all media.',
     '2026-09-12T15:00:00Z'),
    -- Rooftop confession
    ('88888888-8888-4888-8888-888888888804', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777772', 1, 'request', 'pending', 'requested', 'acme',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Featured use on the rooftop; request sent to Ines Calder.',
     '2026-10-18T16:00:00Z'),
    ('88888888-8888-4888-8888-888888888805', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777772', 2, 'start_negotiation', 'requested', 'negotiating', 'rights_holder',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Ines wants to see the scene before quoting.',
     '2026-10-20T11:00:00Z'),
    -- Signal discovered
    ('88888888-8888-4888-8888-888888888806', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777774', 1, 'request', 'pending', 'requested', 'acme',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'Request sent to Northline Publishing for the broadcast cut.',
     '2025-10-01T10:00:00Z'),
    ('88888888-8888-4888-8888-888888888807', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777774', 2, 'start_negotiation', 'requested', 'negotiating', 'rights_holder',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     NULL,
     '2025-10-03T14:00:00Z'),
    ('88888888-8888-4888-8888-888888888808', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777774', 3, 'approve', 'negotiating', 'approved', 'rights_holder',
     '22222222-2222-4222-8222-222222222222', 'Licensing Manager',
     'One-year term, worldwide, broadcast and streaming.',
     '2025-10-10T12:00:00Z'),
    ('88888888-8888-4888-8888-888888888809', '11111111-1111-4111-8111-111111111111',
     '77777777-7777-4777-8777-777777777774', 4, 'expire', 'approved', 'expired', 'system',
     NULL, NULL,
     NULL,
     '2026-10-15T00:05:00Z')
ON CONFLICT (id) DO NOTHING;
