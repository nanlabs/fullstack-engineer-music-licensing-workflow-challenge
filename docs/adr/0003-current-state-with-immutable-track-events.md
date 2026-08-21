# 3. Current Track state with immutable audit events

Date: 2026-08-21

Status: Accepted

## Context

The workflow needs two views of a Track that serve different purposes:

- request handlers and clients need the current definition and licensing state quickly;
- reviewers need an immutable account of who changed what, when, and against which Track version.

Reconstructing current state from every historical change would make ordinary reads depend on an ever-growing event sequence. Updating only one mutable Track row would make current reads simple but erase the facts needed to explain prior licensing outcomes, especially when a revision resets a terminal state to `pending`.

The live stream adds a third concern: a connected client should learn about a committed change only after the new state and its audit entry are durable.

## Decision

Store authoritative current state in `tracks` and append one immutable row to `track_events` for every material Track change.

The current-state row is not a cache rebuilt from events, and the system is not event sourced. REST reads `tracks` directly. `track_events` is an audit record containing the Track and Movie identifiers, Track version, event type, versioned JSON payload, Actor identity, timestamp, and relocation scope where applicable.

A material write performs the Track mutation, event insertion, and PostgreSQL notification in one transaction. The notification is the final statement before commit. PostgreSQL delivers it only after the transaction commits, so subscribers cannot observe a change before an authoritative REST read can return it. Any failure rolls all three effects back together.

No-op `PUT` requests change neither table and emit no notification. This keeps history about domain changes rather than network retries.

Events are ordered for a Track by their globally increasing database ID. History pagination uses that ID rather than timestamps, which may tie. Event payloads carry a schema version so readers can distinguish future shapes.

## Consequences

- Current reads stay constant in shape and do not become more expensive as history grows.
- Audit history preserves former terminal outcomes after a revision starts a new licensing proposition.
- A committed Track version has exactly one corresponding material event.
- The current row and history duplicate some facts. Transactional writes and tests are responsible for keeping them consistent.
- Events are retained indefinitely for this exercise. A production deployment needs an explicit retention and archival policy.
- The event log cannot rebuild the database by itself and is not advertised as a durable integration stream.
- SSE remains best-effort live delivery. Its event identifier supports correlation with history, not replay.

## Alternatives considered

- **Event sourcing** — rejected for this scope. Replaying events or maintaining projections adds operational and schema-evolution complexity without a requirement to reconstruct arbitrary historical state.
- **Mutable Track rows only** — rejected because revisions would erase the evidence behind earlier licensing decisions and Actor attribution.
- **Database triggers for audit rows** — rejected because domain-specific event payloads and Actor identity belong at the application transaction boundary; hiding them in triggers would split the workflow across two implementations.
- **Publishing after commit** — rejected because a process failure between commit and publish would lose a live update even though the writer believed it had delivered one. Transactional `NOTIFY` gives the required commit ordering without an outbox for this best-effort stream.
