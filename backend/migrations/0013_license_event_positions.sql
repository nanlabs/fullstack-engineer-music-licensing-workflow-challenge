-- Licensing bounded context, step 6: real-time delivery. A client that
-- reconnects to the SSE stream (GET /api/v1/events) resumes from the last
-- event it saw, so every license event needs a cursor that is global to the
-- tenant and ordered the way the events became visible.
--
-- Design notes (see docs/licensing.md, "Design notes and sources"):
-- * position is a global identity column: it is the SSE `id` of the event
--   and the value a client sends back as `Last-Event-ID`.
-- * A sequence is assigned inside the transaction, not at commit, so two
--   concurrent transitions can commit in the opposite order of their
--   positions and a reader of "position > N" would skip one. The repository
--   takes pg_advisory_xact_lock(1, hashtext(tenant_id)) right before the
--   INSERT, which holds until commit: within a tenant, positions follow
--   commit order and the replay is exact. Tenants never block each other.
-- * Existing rows (the seed of 0012) are numbered in physical order, which
--   is their insertion order.

ALTER TABLE license_events ADD COLUMN position bigint GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX license_events_position_key ON license_events (position);
CREATE INDEX license_events_tenant_position_idx ON license_events (tenant_id, position);
