-- Development seed: four fictional songs for ACME BROS PICTURES covering the
-- optional fields (with and without ISRC/ISWC, every rights-holder kind and
-- none). Fixed UUIDs keep the README examples copy-pasteable; idempotent like
-- the other seeds. ISWC check digits follow ISO 15707; ISRCs use the "QZ"
-- prefix (not tied to a country) with a made-up registrant.

INSERT INTO songs (id, tenant_id, title, artist, album, release_year, duration_ms, isrc, iswc,
                   rights_holder, rights_holder_kind, rights_holder_email, notes)
VALUES
    ('66666666-6666-4666-8666-666666666661', '11111111-1111-4111-8111-111111111111',
     'Velvet Static', 'The Marrow Lights', 'Night Signals', 2023, 214000,
     'QZACM2300017', 'T9102345675',
     'Harbor Lane Records', 'label', 'licensing@harborlane.test', NULL),
    ('66666666-6666-4666-8666-666666666662', '11111111-1111-4111-8111-111111111111',
     'Last Call at the Blue Room', 'Ines Calder', NULL, 2019, 187500,
     'QZACM1900204', NULL,
     'Ines Calder', 'artist', 'ines@calder.test', NULL),
    ('66666666-6666-4666-8666-666666666663', '11111111-1111-4111-8111-111111111111',
     'Frequency Drift', 'Nocturne Radio', 'Broadcast', 2024, 302000,
     NULL, 'T0711122336',
     'Northline Publishing', 'publisher', NULL, 'Instrumental version available.'),
    ('66666666-6666-4666-8666-666666666664', '11111111-1111-4111-8111-111111111111',
     'Paper Moons', 'Orla & the Tides', NULL, 2021, NULL,
     NULL, NULL,
     'Orla & the Tides', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
