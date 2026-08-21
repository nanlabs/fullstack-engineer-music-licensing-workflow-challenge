# 1. PUT, not PATCH, for track mutations

Date: 2026-08-21

Status: Accepted

## Context

Two endpoints mutate an existing track:

```text
PUT /tracks/{track_id}                    # revise the definition
PUT /tracks/{track_id}/licensing-state    # move through the workflow
```

Both could plausibly have been `PATCH`. Both also need an optimistic-concurrency
precondition, since two people can act on the same track at once.

Three questions had to be settled together, because the answers interact:

1. `PUT` or `PATCH`?
2. Where does the precondition live — `If-Match`, or the request body?
3. What does a retry do?

## Decision

### Use `PUT`

Both endpoints take the **complete desired state** of what they address, and
neither supports field-by-field merging. That is the distinction the HTTP
specification draws: a `PUT` request's content is "the desired state of the
target resource after the request is successfully applied", and PUT explicitly
**does not support partial updates** — RFC 9110 directs partial modification to
`PATCH` instead.

`PATCH` was rejected because nothing in this domain wants merge semantics:

- A revision that changed the song but silently kept the old interval would be a
  different licensing proposition than the client believed they were requesting.
  Requiring the whole definition makes the client state what they mean.
- The licensing endpoint sets one value. "Partially" changing a state has no
  meaning.

`PUT` also buys idempotency. RFC 9110 §9.2.2 defines idempotent methods as those
where "multiple identical requests are expected to have the same effect as a
single request", and says a client **MAY automatically retry** them after a
connection failure. `PATCH` carries no such guarantee, so a client that never
saw its response cannot safely repeat it without an out-of-band idempotency key.

### Keep the precondition in the body

The endpoints take `expected_version` as a body field rather than an `If-Match`
entity tag. This is a **deliberate deviation from the more standard mechanism**,
and it is the weakest part of this decision, so the reasoning is recorded in
full:

- The track already exposes an integer `version`. An entity tag would be a
  second name for the same fact, and clients would have to carry both.
- The precondition and the intent are evaluated *together* — "make it
  `licensed`, and I believed it was at version 3" is one statement, and the
  server's answer depends on both halves at once (see the retry rule below).
  Splitting the two across a header and a body would obscure that.
- `If-Match` failure is `412 Precondition Failed`, which says the precondition
  was not met and nothing more. `409 Conflict` with a `version_conflict` problem
  code and the current version in the detail is more actionable.

The cost is real: `If-Match`/`ETag` is the HTTP-native mechanism, understood by
caches and proxies without reading the body, and a reviewer expecting it will
find its absence surprising. An API fronted by infrastructure that acts on
conditional headers should prefer `If-Match`. This service has no such
infrastructure.

### Define what a retry does

Idempotency here is about **observable server state**, not byte-identical
responses. Both endpoints evaluate "is the desired result already true?" *before*
they check the version:

| Situation | Result |
|---|---|
| Desired result already holds | `200`, no version bump, no event — whatever `expected_version` says |
| Version current, change legal | `200`, version incremented, one event |
| Version stale, different intent | `409 version_conflict` |
| Version current, change illegal | `422 invalid_state_transition` |

Checking the desired result first is what makes a retry safe. A client whose
response was lost repeats its request and gets success, rather than a `409` it
cannot act on — the retry never had a conflicting intent, it just could not tell
whether it had been applied.

## Consequences

- A client must send the whole definition to revise a track. Changing only the
  interval still means sending `scene_id` and `song_id`. This is more verbose,
  and it is the point: the request is unambiguous.
- Clients must read a track before mutating it, to learn its `version`. That is
  inherent to optimistic concurrency, not to this encoding of it.
- Retries are safe without idempotency keys on these two endpoints. **`POST
  /tracks` is not covered by this** — creation has no precondition and duplicate
  tracks are legitimate, so a retried creation may produce a second track. That
  limitation is documented separately.
- Moving to `If-Match` later would be a breaking change to both endpoints,
  though a compatible transition is possible: accept both, and emit `ETag`.

### A caveat worth stating plainly

`PUT /tracks/{track_id}` is not a *strict* `PUT` in one respect. Its body is not
a full track representation: it omits `licensing_state`, `version`, and the
timestamps, and it adds `expected_version`, which is a precondition rather than
resource state. The server also derives part of the outcome — a material
revision resets `licensing_state` to `pending` rather than accepting whatever
the client sent.

RFC 9110 permits this: it allows the origin server to transform a `PUT`
representation, and acknowledges the resulting resource state may differ from
what was sent, provided the difference is documented. The behaviour is described
in the endpoint's own documentation and in the README. A purist reading would
call this `POST`-shaped; the choice here favours the retry and no-op guarantees
that `PUT` communicates, which is what clients of this workflow actually need.

## Alternatives considered

- **`PATCH` with JSON Merge Patch (RFC 7386)** — rejected: merge semantics let a
  caller change a licensing-relevant field while believing the rest is
  untouched, and no idempotency guarantee comes with it.
- **`POST /tracks/{id}/transitions`** as a command endpoint — honest about being
  a command, and a good fit for a system with many transition types carrying
  their own payloads. Rejected here because there are no transition reasons or
  notes in scope, so the command would carry only a target state, and `POST`
  would give up the retry guarantee for nothing.
- **`If-Match` with `412`** — the standards-native option, rejected above with
  its cost acknowledged.

## References

- [RFC 9110 §9.3.4 — PUT](https://httpwg.org/specs/rfc9110.html#PUT)
- [RFC 9110 §9.2.2 — Idempotent Methods](https://httpwg.org/specs/rfc9110.html#idempotent.methods)
- [RFC 5789 — PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789)
- [Zuplo — HTTP PATCH vs PUT](https://zuplo.com/learning-center/http-patch-vs-put-whats-the-difference)
- [Kevin Sookocheff — Optimistic Locking in a REST API](https://sookocheff.com/post/api/optimistic-locking-in-a-rest-api/)
- [Zuplo — Conditional Requests and ETags](https://zuplo.com/learning-center/optimizing-rest-apis-with-conditional-requests-and-etags)
