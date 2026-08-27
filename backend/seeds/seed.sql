-- Seed data for local development.
--
-- IDs are hardcoded so that the curl examples in the README are copy-pasteable
-- and stay valid across resets.

INSERT INTO movies (id, title) VALUES
    ('11111111-1111-1111-1111-111111111111', 'The Last Reel');

INSERT INTO scenes (id, movie_id, name) VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Opening Credits'),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Rooftop Chase');

INSERT INTO songs (id, title, artist) VALUES
    ('33333333-3333-3333-3333-333333333301', 'Neon Dust',      'The Cassette Kids'),
    ('33333333-3333-3333-3333-333333333302', 'Slow Cyanotype', 'Mara Vance'),
    ('33333333-3333-3333-3333-333333333303', 'Concrete Bloom', 'Halogen Wolves');

-- Two tracks left in different states so the workflow is visible right away:
-- the first can move DRAFT -> NEGOTIATING, the second NEGOTIATING -> APPROVED/REJECTED.
INSERT INTO tracks (id, scene_id, song_id, start_time_seconds, end_time_seconds, status) VALUES
    ('44444444-4444-4444-4444-444444444401',
     '22222222-2222-2222-2222-222222222201',
     '33333333-3333-3333-3333-333333333301',
     0, 95, 'DRAFT'),
    ('44444444-4444-4444-4444-444444444402',
     '22222222-2222-2222-2222-222222222202',
     '33333333-3333-3333-3333-333333333302',
     120, 210, 'NEGOTIATING');
