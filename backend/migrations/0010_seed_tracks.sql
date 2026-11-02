-- Development seed: four tracks in the seeded scenes. "Paper Moons" stays
-- unplaced and "Static" keeps no scenes, so a free song and an empty movie
-- remain visible. Fixed UUIDs, idempotent like the other seeds.

INSERT INTO tracks (id, tenant_id, scene_id, song_id, start_ms, end_ms, usage)
VALUES
    -- The Last Encore / Opening night (0:00 - 3:00): Velvet Static under the walk on stage
    ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111',
     '55555555-5555-4555-8555-555555555551', '66666666-6666-4666-8666-666666666661',
     15000, 95000, 'background'),
    -- The Last Encore / Rooftop confession (7:00 - 10:00): Last Call at the Blue Room, featured
    ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111',
     '55555555-5555-4555-8555-555555555552', '66666666-6666-4666-8666-666666666662',
     430000, 520000, 'featured'),
    -- The Last Encore / Final bow (no window): Velvet Static again, the reprise
    ('77777777-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111',
     '55555555-5555-4555-8555-555555555553', '66666666-6666-4666-8666-666666666661',
     5400000, 5580000, 'featured'),
    -- Midnight Frequencies / Signal discovered (0:00 - 1:35): Frequency Drift between stations
    ('77777777-7777-4777-8777-777777777774', '11111111-1111-4111-8111-111111111111',
     '55555555-5555-4555-8555-555555555554', '66666666-6666-4666-8666-666666666663',
     10000, 60000, 'background')
ON CONFLICT (id) DO NOTHING;
