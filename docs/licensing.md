# Licensing domain

ACME BROS PICTURES licenses songs for the scenes of its movies. This document
is the domain model, the license workflow and the real-time design. The
implementation lives in `backend/crates/licensing` and follows the module shape
described in [architecture.md](architecture.md).

## Model

```
tenant ─┬─ users ─────────────── ACME staff: they log in, hold scopes and are
        │                        the actor of every license event
        ├─ movies ─── scenes ─── tracks ─┬─ licenses ─── license_events (actor → users)
        │   (cascade)   (cascade)        │  (cascade, 1:1)  (cascade, append-only)
        └─ songs ◀─────────────────────────┘ (song_id, tenant_id), ON DELETE RESTRICT
             · rights_holder / kind / email: the external counterparty, data only
```

Two things the diagram makes explicit. Deleting a movie cascades to its
scenes, tracks and licenses (ownership); deleting a song that a track still
references is refused (reference). And the people who negotiate are ACME
staff (`users`); the rights holder they negotiate _with_ is described by
columns on the song and never logs in.

| Entity    | Status      | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movie`   | implemented | Catalogue entry that owns scenes. `title`, optional `synopsis` and `release_year`, production `status` (`draft`, `in_production`, `released`, `archived`). The status is informational and does not gate licensing.                                                                                                                                                                                                                                                       |
| `scene`   | implemented | Ordered segment of a movie that needs music. Belongs to exactly one movie: `title`, optional `description`, server-assigned `position` and an optional `start_ms`/`end_ms` window inside the movie.                                                                                                                                                                                                                                                                       |
| `song`    | implemented | Licensable music, shared by every movie of the tenant: `title`, `artist`, optional `album`, `release_year`, `duration_ms`, the industry identifiers `isrc` (recording) and `iswc` (work), and the rights holder ACME negotiates with (`rights_holder`, optional `rights_holder_kind` `artist`/`label`/`publisher` and `rights_holder_email`). No license state: that belongs to the track.                                                                                |
| `track`   | implemented | A song placed in a scene: the cue. `song_id`, `start_ms`/`end_ms` on the movie timeline (inside the scene's window when it has one) and `usage` (`background` or `featured`). Owned by the scene (cascade), references the song (restrict). The unit that gets licensed; reads embed `movie_id`, a song summary and the derived `duration_ms`.                                                                                                                            |
| `license` | implemented | The negotiation attached to a track, one row per track (`licenses`, keyed by the track id): `state`, `version` (number of applied events, the concurrency guard) and the optional `expires_at` (end of the agreed term, set on approval). Every transition is appended to `license_events`: event, from/to, `source` (`acme`, `rights_holder` or `system`), the ACME user who recorded it, an optional note and the time. Born `pending` with the track, deleted with it. |

Every table carries `tenant_id`; repositories always filter by it, so a row of
another tenant behaves exactly like a row that does not exist (404, never 403).

## License workflow

Each track owns one license that moves through an explicit state machine. The
transition table is pure code (`transition(state, event) -> Result<state, _>`),
unit-tested without a database, and every applied transition is appended to
`license_events` (who, when, from, to, optional note) so the UI can show the
negotiation history.

```
pending ──request──▶ requested ──start_negotiation──▶ negotiating
                        │                                 │
                      reject                        approve / reject
                        ▼                                 ▼
                     rejected ◀───────────────────── rejected | approved
                        │                                      │
                      reopen ──▶ negotiating                 expire
                                                               ▼
                                                            expired
```

| Event               | From                       | To            | Meaning                                                |
| ------------------- | -------------------------- | ------------- | ------------------------------------------------------ |
| `request`           | `pending`                  | `requested`   | The request was sent to the rights holder.             |
| `start_negotiation` | `requested`                | `negotiating` | The rights holder answered; terms are being discussed. |
| `approve`           | `negotiating`              | `approved`    | Terms accepted; the license is granted.                |
| `reject`            | `requested`, `negotiating` | `rejected`    | The rights holder (or ACME) declined.                  |
| `reopen`            | `rejected`                 | `negotiating` | A rejected request is renegotiated.                    |
| `expire`            | `approved`                 | `expired`     | The license term ended.                                |

`approved`, `rejected` and `expired` are the resting states, with `rejected`
reopenable and `expired` the only dead end. Any event not listed for the
current state is a `422 LICENSE_INVALID_TRANSITION` error naming the state,
the event and the events that _are_ allowed. The licensing status embedded
in track responses is read with the movie scopes (it is part of the track);
the history needs `licenses:read` and every transition `licenses:write`.

### Moving a license

`POST /tracks/{id}/license/{event}` applies one event and answers with the
updated track. The body is optional (`{}` is fine) and may carry:

| Field            | Meaning                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `note`           | Free text for the history (what was quoted, asked or agreed), up to 2000 characters.                                                                                                                                           |
| `source`         | Who decided: `acme` or `rights_holder`. Defaults per event: `request`, `reopen` and `expire` are ACME's moves; `start_negotiation`, `approve` and `reject` are the holder's answer. `system` is reserved for the expiry sweep. |
| `expires_at`     | End of the agreed term (RFC 3339). Only accepted with `approve`, must be in the future; omitted means no date.                                                                                                                 |
| `expected_state` | The state the client last saw. A mismatch is a `409 LICENSE_STATE_STALE` with the current state, so two people working on the same license never apply an event to a state neither of them read.                               |

Each applied event is recorded with the ACME user who recorded it
(`actor`: id and a snapshot of the name) and bumps the license `version`;
the write is `UPDATE … WHERE version = <read>` plus the event insert in one
transaction, so a lost race is also a 409 and never a duplicate or a lost
event. `GET /tracks/{id}/license/events` returns the history oldest first.

### Expiry

`approve` stores the term's end as `expires_at`; track responses expose it so
the UI can flag a license that is about to lapse. A background sweep
(`LICENSE_EXPIRY_SWEEP_INTERVAL`, 5 minutes by default, first run at
startup) moves every `approved` license whose date has passed to `expired`,
recording the event with `source = system` and no actor. A manual `expire`
remains available and keeps the stored date; if both race, the version guard
lets one through and the sweep skips the other.

## Real-time updates

Other users must see licensing changes immediately. The transport is
**Server-Sent Events**: `GET /api/v1/events` keeps a response open and
writes one message per committed transition of the caller's tenant.

| Message                                    | When                                                                                         | Payload                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retry: 3000` then `: connected`           | On open                                                                                      | Sets the browser's reconnection delay; the comment dispatches nothing.                                                                                                                                                                                                                                                    |
| `event: license.changed`, `id: <position>` | After every applied transition, from a request or from the expiry sweep                      | `{ position, tenant_id, event, from_state, to_state, source, seq, occurred_at, track }`, where `track` is the full track item (same shape as `GET /tracks/{id}`, license included), so the UI replaces the row without another call. No `note` and no actor: the stream is read with `movies:read`; the history has them. |
| `event: resync`                            | One read of the log, on reconnect or live, found more than `SSE_REPLAY_LIMIT` events pending | `{ "reason": "replay_truncated" }`. The client reloads its lists and keeps listening; the stream goes on from the last event it sent, a limit at a time, and skips nothing.                                                                                                                                               |
| `: keep-alive`                             | Every `SSE_KEEP_ALIVE_INTERVAL` of silence                                                   | Keeps proxies from closing an idle connection. A comment carries no `id`, so it never moves the client's cursor.                                                                                                                                                                                                          |

- **Authentication** is the access cookie. `EventSource` cannot set headers,
  and the IAM middleware already accepts the cookie the login sets, so the
  browser opens `new EventSource("/api/v1/events", { withCredentials: true })`
  and nothing else; CORS allows credentials and the `Last-Event-ID` header.
  The Bearer header works too (`curl -N`). 401, 403 and 400 are the usual
  JSON replies, and a non-200 status also tells `EventSource` not to retry.
- **Resuming.** Every stored event has a tenant-wide `position`
  (`license_events.position`), which is the SSE `id`. On reconnect the
  browser sends the last one back as `Last-Event-ID`; the server replays the
  events after it from the table (at most `SSE_REPLAY_LIMIT`, then `resync`)
  before going live. Without `Last-Event-ID` the stream starts at the head of
  the log: what was committed before the connect is in the lists the client
  loads, what comes after is in the stream. Events of a track deleted in the
  meantime are gone with it. A `Last-Event-ID` that is not a position is a 400.
- **The bus is a wake-up, the log is the stream.** A live stream never
  forwards what it hears on the bus. A notice of its tenant (or falling
  behind the bus) only says the log grew; the stream then reads
  `license_events` after the last position it sent and emits what it finds,
  in position order, with a burst of notices costing one read. Publication
  runs after the commit and outside the per-tenant lock, so two transitions
  can be announced in the reverse of their positions; reading the log makes
  the order of announcements irrelevant, and the lock guarantees that when
  position N+1 is committed so is N, so no read jumps over a gap.
- **Lifetime.** The context captured at connect time would outlive the access
  token, so a stream is closed after `SSE_MAX_CONNECTION_AGE` (15 minutes,
  the token's TTL); the browser reconnects at once with the current cookie,
  which re-validates user, tenant and session. Streams also close when the
  process is asked to stop, so a graceful shutdown does not wait on them.
- **Inside the backend**, `LicenseService` publishes a `LicenseChanged`
  through the `EventPublisher` port right after the transaction commits; a
  failed publish is a warning, never an error for the request. The default
  adapter is an in-process `tokio::sync::broadcast` bus. With `REDIS_URL`
  set, the publisher writes to the Redis channel `licensing.license_changed`
  and a background subscriber on every instance (the publishing one
  included) relays the channel into its local bus: one path, and clients of
  any instance see every change. Redis pub/sub is fire-and-forget and the
  bus drops what a slow reader missed; neither matters, because both are
  wake-ups: the table is the source of truth and every stream reads it.
- **The frontend** listens for `license.changed`, replaces the affected track
  with `data.track` (filtering by `track.movie_id` for the page it shows),
  reloads on `resync` and lets `EventSource` reconnect on its own.

Why SSE and not WebSocket: the flow is one-directional (server to browser),
SSE reconnects automatically with a cursor, works through plain HTTP proxies
and needs no extra protocol on the client. WebSocket stays the fallback if
the UI ever has to push messages to the server. Browsers cap HTTP/1.1
connections per host at six, so it is one stream per tab; many tabs would
share one through a worker.

## Endpoints (`/api/v1`)

All routes require an access token, as a Bearer header or as the access
cookie the login sets (see [iam.md](iam.md)); the events stream is the one
place the cookie matters, because `EventSource` cannot send headers.

| Method   | Path                              | Scope            | Notes                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/movies`                         | `movies:read`    | Paginated (`page`, `page_size`), filters `q` (title substring, case-insensitive) and `status`. Ordered by title.                                                                                                                                                                                                                                                         |
| `POST`   | `/movies`                         | `movies:write`   | `{ title, synopsis?, release_year?, status? }` → 201.                                                                                                                                                                                                                                                                                                                    |
| `GET`    | `/movies/{id}`                    | `movies:read`    |                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT`    | `/movies/{id}`                    | `movies:write`   | Partial update; absent fields keep their value, `"synopsis": ""` clears it.                                                                                                                                                                                                                                                                                              |
| `DELETE` | `/movies/{id}`                    | `movies:write`   | 204; scenes and their tracks go with it. 409 `MOVIE_HAS_ACTIVE_LICENSES` while a track in one of its scenes has an active license (`requested`, `negotiating` or `approved`); `details.track_ids` lists them. Reject or expire those first.                                                                                                                              |
| `GET`    | `/movies/{movie_id}/scenes`       | `movies:read`    | Every scene of the movie ordered by `position`, as `{ items, count }` (not paginated). 404 `MOVIE_NOT_FOUND` for an unknown or foreign movie.                                                                                                                                                                                                                            |
| `POST`   | `/movies/{movie_id}/scenes`       | `movies:write`   | `{ title, description?, start_ms?, end_ms? }` → 201. Appended at the end (`position = max + 1`).                                                                                                                                                                                                                                                                         |
| `PUT`    | `/movies/{movie_id}/scenes/order` | `movies:write`   | `{ scene_ids: [...] }` naming every scene of the movie exactly once → 200 with the ordered list; positions become `1..n`.                                                                                                                                                                                                                                                |
| `GET`    | `/scenes/{id}`                    | `movies:read`    |                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT`    | `/scenes/{id}`                    | `movies:write`   | Partial update; `"description": ""` clears the text, `"start_ms": null, "end_ms": null` clear the window. `position` is not editable here. 409 `SCENE_WINDOW_CONFLICT` when the new window would leave tracks outside it (`details.track_ids`).                                                                                                                          |
| `DELETE` | `/scenes/{id}`                    | `movies:write`   | 204; its tracks go with it. 409 `SCENE_HAS_ACTIVE_LICENSES` while one of them has an active license (`details.track_ids`). Leaves a gap in `position`; the next reorder compacts.                                                                                                                                                                                        |
| `GET`    | `/songs`                          | `movies:read`    | Paginated (`page`, `page_size`), filter `q` (substring of title **or** artist, case-insensitive). Ordered by title.                                                                                                                                                                                                                                                      |
| `POST`   | `/songs`                          | `movies:write`   | `{ title, artist, rights_holder, album?, release_year?, duration_ms?, isrc?, iswc?, rights_holder_kind?, rights_holder_email?, notes? }` → 201. `isrc`/`iswc` accepted in print form (`GB-AAA-24-00001`, `T-034.524.680-1`) and returned canonical.                                                                                                                      |
| `GET`    | `/songs/{id}`                     | `movies:read`    |                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT`    | `/songs/{id}`                     | `movies:write`   | Partial update; `""` clears `album`, `isrc`, `iswc`, `rights_holder_email` or `notes`; `null` clears `release_year`, `duration_ms` or `rights_holder_kind`.                                                                                                                                                                                                              |
| `DELETE` | `/songs/{id}`                     | `movies:write`   | 204, or 409 `SONG_IN_USE` while a track references the song.                                                                                                                                                                                                                                                                                                             |
| `GET`    | `/scenes/{scene_id}/tracks`       | `movies:read`    | Every track of the scene ordered by `start_ms`, as `{ items, count }`. Each item embeds `movie_id`, `song: { id, title, artist, rights_holder }`, the derived `duration_ms` and `license: { state, updated_at, expires_at, allowed_events }`. `?state=approved` keeps one license state (400 for an unknown one). 404 `SCENE_NOT_FOUND` for an unknown or foreign scene. |
| `POST`   | `/scenes/{scene_id}/tracks`       | `movies:write`   | `{ song_id, start_ms, end_ms, usage }` → 201 with a `pending` license. Timecodes in milliseconds on the movie timeline, `start_ms < end_ms`, inside the scene's window when it has one; `usage` is `background` or `featured`. An unknown or foreign `song_id` is a 400 naming the field.                                                                                |
| `GET`    | `/movies/{movie_id}/tracks`       | `movies:read`    | Every track of every scene of the movie, ordered by scene position and then `start_ms`; same item shape and `?state=` filter. 404 `MOVIE_NOT_FOUND`.                                                                                                                                                                                                                     |
| `GET`    | `/tracks/{id}`                    | `movies:read`    |                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT`    | `/tracks/{id}`                    | `movies:write`   | Partial update of `song_id`, `start_ms`, `end_ms`, `usage`; the span and window rules apply to the result. `scene_id` is not editable. 409 `TRACK_LOCKED_BY_LICENSE` when a field really changes while the license is active (`details.state`, `details.fields`); repeating the stored values is a no-op 200.                                                            |
| `DELETE` | `/tracks/{id}`                    | `movies:write`   | 204; its license and history go with it. 409 `TRACK_LOCKED_BY_LICENSE` while the license is active (`details.state`).                                                                                                                                                                                                                                                    |
| `POST`   | `/tracks/{id}/license/{event}`    | `licenses:write` | `event` is `request`, `start_negotiation`, `approve`, `reject`, `reopen` or `expire`; body `{ note?, source?, expires_at?, expected_state? }` (see "Moving a license") → 200 with the updated track. 422 `LICENSE_INVALID_TRANSITION`, 409 `LICENSE_STATE_STALE`, 400 for an unknown event or a bad `expires_at`.                                                        |
| `GET`    | `/tracks/{id}/license/events`     | `licenses:read`  | The history as `{ items, count }`, oldest first: `{ id, seq, event, from_state, to_state, source, actor: { user_id, name } \| null, note, created_at }`.                                                                                                                                                                                                                 |
| `GET`    | `/events`                         | `movies:read`    | Server-Sent Events of the tenant (see "Real-time updates"): `text/event-stream` with one `license.changed` per transition, each carrying the full track; `Last-Event-ID` replays what was missed; `resync` asks for a reload; comments keep the connection alive. Cookie or Bearer.                                                                                      |

## Error codes

| Code                         | HTTP | When                                                                                                                                                                                                                        |
| ---------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`           | 400  | Invalid body, query string, path parameter or `Last-Event-ID` header (details name the field).                                                                                                                              |
| `ACCESS_DENIED`              | 403  | Missing scope; `details.required_scope` names it.                                                                                                                                                                           |
| `MOVIE_NOT_FOUND`            | 404  | Unknown id or a movie of another tenant, also on `/movies/{movie_id}/scenes`.                                                                                                                                               |
| `SCENE_NOT_FOUND`            | 404  | Unknown id or a scene of another tenant.                                                                                                                                                                                    |
| `SCENE_ORDER_STALE`          | 409  | The scenes of the movie changed between reading and reordering; reload and retry.                                                                                                                                           |
| `SONG_NOT_FOUND`             | 404  | Unknown id or a song of another tenant.                                                                                                                                                                                     |
| `SONG_ISRC_TAKEN`            | 409  | Another song of the tenant already carries that ISRC (`details.field` = `isrc`).                                                                                                                                            |
| `SONG_IN_USE`                | 409  | The song is placed in at least one track; remove the tracks first.                                                                                                                                                          |
| `TRACK_NOT_FOUND`            | 404  | Unknown id or a track of another tenant.                                                                                                                                                                                    |
| `SCENE_WINDOW_CONFLICT`      | 409  | The requested scene window would leave tracks outside it; `details.track_ids` lists them.                                                                                                                                   |
| `TRACK_LOCKED_BY_LICENSE`    | 409  | The track's license is `requested`, `negotiating` or `approved`, so its song, timing and usage are frozen and it cannot be deleted; `details.state`, and `details.fields` on an update. Reject or expire the license first. |
| `SCENE_HAS_ACTIVE_LICENSES`  | 409  | Deleting the scene would remove tracks with an active license; `details.track_ids` lists them.                                                                                                                              |
| `MOVIE_HAS_ACTIVE_LICENSES`  | 409  | Deleting the movie would remove tracks with an active license; `details.track_ids` lists them.                                                                                                                              |
| `LICENSE_INVALID_TRANSITION` | 422  | The event is not allowed in the license's current state; `details.state`, `details.event` and `details.allowed_events`.                                                                                                     |
| `LICENSE_STATE_STALE`        | 409  | `expected_state` differs from the current state, or the license moved between reading and writing; `details.state` is where it is now. Reload and retry.                                                                    |

## Seed data (migrations `0004_seed_movies.sql`, `0006_seed_scenes.sql`, `0008_seed_songs.sql`, `0010_seed_tracks.sql`, `0012_seed_licenses.sql`)

Three ACME movies with fixed ids so the catalogue is never empty:

| Id                                     | Title                | Status          |
| -------------------------------------- | -------------------- | --------------- |
| `44444444-4444-4444-8444-444444444441` | The Last Encore      | `in_production` |
| `44444444-4444-4444-8444-444444444442` | Midnight Frequencies | `released`      |
| `44444444-4444-4444-8444-444444444443` | Static               | `draft`         |

Scenes for two of them ("Static" has none, so the empty list is visible):

| Id                                     | Movie                | Position | Title              | Window        |
| -------------------------------------- | -------------------- | -------- | ------------------ | ------------- |
| `55555555-5555-4555-8555-555555555551` | The Last Encore      | 1        | Opening night      | 0:00 – 3:00   |
| `55555555-5555-4555-8555-555555555552` | The Last Encore      | 2        | Rooftop confession | 7:00 – 10:00  |
| `55555555-5555-4555-8555-555555555553` | The Last Encore      | 3        | Final bow          | none          |
| `55555555-5555-4555-8555-555555555554` | Midnight Frequencies | 1        | Signal discovered  | 0:00 – 1:35   |
| `55555555-5555-4555-8555-555555555555` | Midnight Frequencies | 2        | The broadcast      | 30:00 – 35:00 |

Four fictional songs (no real artists) covering the optional fields:

| Id                                     | Title                      | Artist            | ISRC           | ISWC          | Rights holder                      |
| -------------------------------------- | -------------------------- | ----------------- | -------------- | ------------- | ---------------------------------- |
| `66666666-6666-4666-8666-666666666661` | Velvet Static              | The Marrow Lights | `QZACM2300017` | `T9102345675` | Harbor Lane Records (`label`)      |
| `66666666-6666-4666-8666-666666666662` | Last Call at the Blue Room | Ines Calder       | `QZACM1900204` | —             | Ines Calder (`artist`)             |
| `66666666-6666-4666-8666-666666666663` | Frequency Drift            | Nocturne Radio    | —              | `T0711122336` | Northline Publishing (`publisher`) |
| `66666666-6666-4666-8666-666666666664` | Paper Moons                | Orla & the Tides  | —              | —             | Orla & the Tides (no kind)         |

Four tracks, so every list has something to show and a song is in use
("Paper Moons" stays unplaced, "Static" stays empty):

| Id                                     | Scene              | Song                       | Span              | Usage        |
| -------------------------------------- | ------------------ | -------------------------- | ----------------- | ------------ |
| `77777777-7777-4777-8777-777777777771` | Opening night      | Velvet Static              | 0:15 – 1:35       | `background` |
| `77777777-7777-4777-8777-777777777772` | Rooftop confession | Last Call at the Blue Room | 7:10 – 8:40       | `featured`   |
| `77777777-7777-4777-8777-777777777773` | Final bow          | Velvet Static (reprise)    | 1:30:00 – 1:33:00 | `featured`   |
| `77777777-7777-4777-8777-777777777774` | Signal discovered  | Frequency Drift            | 0:10 – 1:00       | `background` |

Their licenses, at different points of the workflow (events recorded by the
seeded licensing manager; "Final bow" stays `pending` so the README
walkthrough can run `request → reject → reopen → approve` on it):

| Track                                           | State         | History                                                                      | `expires_at` |
| ----------------------------------------------- | ------------- | ---------------------------------------------------------------------------- | ------------ |
| Opening night / Velvet Static                   | `approved`    | request (acme) → start_negotiation (rights_holder) → approve (rights_holder) | 2031-12-31   |
| Rooftop confession / Last Call at the Blue Room | `negotiating` | request (acme) → start_negotiation (rights_holder)                           | —            |
| Final bow / Velvet Static                       | `pending`     | —                                                                            | —            |
| Signal discovered / Frequency Drift             | `expired`     | request → start_negotiation → approve → expire (`system`, no actor)          | 2026-10-15   |

## Design notes and sources

Decisions that are not obvious from the code, with the research behind them.

### Scenes hang from movies, one level deep

The collection is nested (`/movies/{movie_id}/scenes`) because a scene never
exists without its movie; the item is flat (`/scenes/{id}`) so the next level
(`/scenes/{id}/tracks`) does not grow into `/movies/{m}/scenes/{s}/tracks/{t}`.
This is the usual compromise for strict ownership: nest one level for
readability, keep deeper resources addressable on their own
([Moesif](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Best-Practices-for-Sub-and-Nested-Resources/),
[Codidact](https://software.codidact.com/posts/285499),
[CVAT design guide](https://docs.cvat.ai/v1.7.0/docs/contributing/rest-api-design)).

In actix-web the first scope whose prefix matches keeps the request and never
backtracks to a sibling (`actix-router`, `Router::recognize_fn`), so the nested
collection is registered _inside_ `web::scope("/movies")`; a top-level
`/movies/{movie_id}/scenes` scope would be shadowed by `/movies`.

### Timing lives on the track; the scene keeps an optional window

Industry cue sheets log music per _cue_: in/out timecodes and a usage code
(`BI` background instrumental, `BV` background vocal, `VI` visual
instrumental, `VV` visual vocal, main/end title), and the usage drives
royalties. That maps to `track`, which the challenge also requires to carry a
start and an end. A scene therefore stores only `title`, `description`,
`position` and an optional `start_ms`/`end_ms` window, used to check that its
tracks fall inside it and to draw a timeline. Production breakdowns add a
script scene number (`12A`), INT/EXT, location and time of day; those are
optional future columns, not needed by the challenge
([Orfium](https://www.orfium.com/cue-sheets/cue-sheets-guide-tv-film-music-licensing/),
[Soundstripe](https://www.soundstripe.com/blogs/what-is-a-cue-sheet-and-why-it-matters),
[Entertainment Partners](https://mms-docs.ep.com/Breakdown/SceneHeaderInformation.html)).

Timecodes are integer milliseconds: precise enough for cues, trivial to
compare in SQL, and the UI formats them as `h:mm:ss.mmm`.

### The database enforces tenant consistency

`scenes (movie_id, tenant_id)` is a composite foreign key to
`movies (id, tenant_id)`, so a scene whose tenant differs from its movie's is
impossible even if a service forgets a check. The redundant
`UNIQUE (id, tenant_id)` on `movies` exists only to be that target. Every
child table that follows uses the same pattern
([PostgreSQL, foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)).

### The server owns `position`

Creating appends (`max + 1`); `PUT /movies/{movie_id}/scenes/order` rewrites
`1..n` in one statement from the full list of ids. `UNIQUE (movie_id, position)`
is `DEFERRABLE INITIALLY DEFERRED` so that statement never collides with itself
half way through, and both writers lock the movie row (`SELECT ... FOR UPDATE`)
so concurrent appends and reorders on one movie are serialized. The service
validates the set (missing, unknown and duplicated ids → 400 with details) and
the adapter re-checks the count under the lock (→ 409 `SCENE_ORDER_STALE`)
([PostgreSQL, CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)).

### Partial updates

`PUT` bodies are partial: an absent key keeps the value. Text fields clear
with `""`; nullable numbers clear with `null` (`kernel::json::double_option`
tells "absent" from "null"). `scene` uses both conventions.

### Songs are a tenant catalogue, not children of movies

A recording can be placed in several scenes of several movies, so `song` is a
flat, paginated collection (`/songs`) like `/movies`, with `q` matching the
title or the artist. Tracks reference it with a composite
`(song_id, tenant_id)` foreign key (the redundant `UNIQUE (id, tenant_id)` on
`songs` is its target) and `ON DELETE RESTRICT`: deleting a movie cascades
because it _owns_ its scenes, deleting a song that is still _referenced_ is a
`409 SONG_IN_USE`. That split follows the usual guidance: cascade for strict
ownership, refuse (and let the client remove the references first) for
references
([Google AIP-135](https://google.aip.dev/135),
[Bird, `ResourceInUse`](https://bird.com/docs/api/errors/E01028)).

### Two rights, two identifiers

A sync placement needs two permissions: the **master** (the recording, held
by a label or an independent artist) and the **publishing** (the composition,
held by a publisher or the writers). The industry identifies each side with
its own code: the **ISRC** (ISO 3901) for the recording and the **ISWC**
(ISO 15707) for the work. A song therefore carries both, optional, and the
challenge's single `rights_holder` is the party ACME talks to; splitting it
into master and publishing contacts (and a `rights_holders` table shared by
many songs) is the natural extension, documented but not built.

Both codes are stored canonical, upper case without separators, and validated
in the service with the database `CHECK`s as a mirror:

- ISRC: 12 characters, printed `CC-XXX-YY-NNNNN`. Positions 1–2 letters
  (prefix, historically the country), 3–5 letters or digits (registrant),
  6–7 digits (year of reference), 8–12 digits (designation). Hyphens are
  presentation only, so `gb-aaa-24-00001` becomes `GBAAA2400001`
  ([IFPI, ISRC structure](https://isrc.ifpi.org/isrc-standard/isrc-structure),
  [IFPI Bulletin 2015-01, validation rules](https://isrc.ifpi.org/downloads/ISRC_Bulletin-2015-01.pdf)).
- ISWC: `T`, nine digits and a check digit, printed `T-DDD.DDD.DDD-C` with
  `S = 1 + Σ i·dᵢ` (i = 1..9) and `C = (10 − S mod 10) mod 10`; the standard's
  own example `T-034.524.680-1` is the unit-test fixture
  ([ISO 15707 / ISWC](https://en.wikipedia.org/wiki/International_Standard_Musical_Work_Code)).

MusicBrainz models the same reality as _work_, _recording_ and _release_
([schema](https://musicbrainz.readthedocs.io/en/latest/musicbrainz_database/schema/_schema.html));
one `song` row with both identifiers is enough for the challenge. Background on
what supervisors ask for:
[Produce Like a Pro](https://producelikeapro.com/blog/sync-licensing-how-to-license-your-music-guide/),
[Symphonic](https://blog.symphonic.com/2020/02/how-to-prepare-music-for-sync-licensing/).

### Rights holders are counterparties, not users

How a sync license is actually negotiated: the music supervisor picks a song
for a scene (the `track`); clearance finds who controls the master and the
publishing; a quote request describes production, scene, duration, usage,
territory, term and media (`request`); the holder answers by e-mail or phone
with a fee and conditions, sometimes asking to see the scene or for
most-favoured-nations terms with the other side, and the parties go back and
forth (`start_negotiation`, notes on every step); a contract is signed and
paid (`approve`) or the holder declines (`reject`, reopenable); after release
the cue sheet is filed and, when the term ends, the license `expire`s.

Every one of those steps is performed and recorded by ACME staff. The rights
holder takes part outside the system, so it is a record, not an account, the
way a CRM stores customers without giving them a login:

- it is not a member of the tenant: a label negotiates with many studios at
  once, and the challenge's "other users" who must see updates are ACME's
  team;
- confidentiality: a holder must never see which other songs ACME considers,
  the scenes of an unreleased film or the offers made to competing holders,
  which would need a per-license isolation on top of the per-tenant one;
- traceability: the `actor` of each license event is the ACME user who
  recorded it; a second actor type with opposite permissions on the same row
  is exactly what the IAM model avoids.

A portal where holders accept or decline themselves would be a new `Actor`
kind in IAM, invited by token and scoped to its own licenses: a valid
extension, not part of the challenge. To keep the history honest about who
moved, the `license` plan adds `source = acme | rights_holder` to each event.

### ISRC is unique per tenant; titles are not

`CREATE UNIQUE INDEX ... ON songs (tenant_id, isrc) WHERE isrc IS NOT NULL`
keeps one ISRC per tenant while songs without one never collide (the partial
index simply does not contain them). The same ISRC may exist in another
tenant. Title plus artist stay free because live versions, remixes and
re-records legitimately share a name and differ by ISRC. The adapter maps a
violation of that index, by constraint name, to `409 SONG_ISRC_TAKEN`
([PostgreSQL, partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html),
[PostgreSQL, CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)).

### Constraint violations become domain errors in one place

`licensing::db::violation` classifies a failed statement (unique, foreign key,
check, with the constraint name) so each adapter decides what it means for
its module: the ISRC index is `SONG_ISRC_TAKEN`, a foreign-key violation on
delete is `SONG_IN_USE`, anything else stays an internal error. Services never
look at `sqlx` errors.

### A track is a cue

Cue sheets, the per-production report studios file with the performing
rights organizations, log one line per cue: composition, writers, publisher,
the _actual use time_ and a _type usage_ code: `B/I` background
instrumental, `B/V` background with vocal, `V/I` visual instrumental (an
on-camera performance), `V/V` visual with vocal, `M/T` main theme and `E/T`
end theme. DDEX carries the same information in `CueUseType` (`Background`,
`OnScreenMusic`, `Theme`/`FilmTheme`, `AudioLogo`, …), and the quote request
forms of the publishers ask for exactly that: the scene, the type of use,
the timing of the use, then term, territory and media
([Soundstripe](https://www.soundstripe.com/blogs/what-is-a-cue-sheet-and-why-it-matters),
[DDEX, `CueUseType`](https://service.ddex.net/dd/DD-AVS-CURRENT.old-2025-08-15/dd/avs_CueUseType.html),
[Wise Music, sync request form](https://wisemusiccreative.com/media/5phdnu5o/synchronization-definitions-request-form.pdf),
[Arts Law, sync licence factsheet](https://www.artslaw.com.au/wp-content/uploads/2024/06/06_Music_Synchronisation_Licence_Factsheet-1.pdf)).

`track.usage` keeps the split the challenge names and the one that moves the
quote: `background` (`B/I`, `B/V`) or `featured` (`V/I`, `V/V`, `M/T`,
`E/T`). Replacing it with the six codes is one migration (the `CHECK` and
the enum) and is the expected extension once cue sheets are generated from
the data. Term, territory, media and fee belong to the license, not to the
track: the term is the license's `expires_at`; territory, media and fee
travel in the notes of the negotiation for now (see "The license is its own
row" below).

### Tracks live on the movie timeline, inside their scene

DDEX measures a cue's `StartTime`/`EndTime` "from the start of the
Resource", the whole program, and so do cue sheets
([DDEX, `Cue`](https://service.ddex.net/dd/MWL20-CAML10-MLC10/DD/ern_Cue.html)).
`start_ms`/`end_ms` therefore count from the start of the movie, and the
scene's optional window is the envelope: a track must fall inside it. The
rule spans two tables, so no `CHECK` can hold it and a trigger would hide
it; the services enforce it from both sides instead. `TrackService` checks
the window on create and update (400 naming the field and the bounds), and
`SceneService` asks the track port for the tracks a narrower window would
leave outside and refuses with `409 SCENE_WINDOW_CONFLICT` and their ids.
Clearing the window never conflicts.

Tracks may overlap: crossfades and score under source music are normal, so
there is no exclusion constraint. A tenant that wanted to forbid overlaps
would add `EXCLUDE USING gist (scene_id WITH =, int4range(start_ms, end_ms) WITH &&)`
with `btree_gist`
([Red Gate, overlapping ranges](https://www.red-gate.com/simple-talk/databases/postgresql/overlapping-ranges-in-subsets-in-postgresql/)).

### Reading tracks across scenes

"All tracks of a movie" is a read across every scene of the movie. Google's
AIP-159 does it with a wildcard parent (`publishers/-/books`), requires each
item to carry its real parent and advises against client ordering on such
reads because the order is ambiguous
([AIP-159](https://google.aip.dev/159)). `GET /movies/{movie_id}/tracks` is
the pragmatic form of `/movies/{m}/scenes/-/tracks`: every item carries
`scene_id` and `movie_id`, the order is fixed (scene position, then
`start_ms`) and neither list is paginated, like `/movies/{id}/scenes`.

Inside one actix scope the patterns do not compete: a prefix pattern is
anchored to a segment boundary (`(/|$)`) and a full route to the end (`$`),
so `/{movie_id}/scenes` never captures `/{movie_id}/tracks` and `/{id}`
never captures `/{scene_id}/tracks` (`actix-router` 0.5,
`ResourceDef::parse`). The database test asks for `/movies/{id}`,
`/movies/{id}/scenes` and `/movies/{id}/tracks` back to back to prove it.

### The track response embeds a song summary

The UI draws a scene or a movie as a list of cues with the song's title,
artist and rights holder on each row. Fetching `/songs/{id}` per row would
be an N+1 round trip, so the track repository returns a read model
(`TrackView`: the track, its `movie_id` and a `SongSummary`) built with two
joins, and the response adds the derived `duration_ms`, the cue sheet's
"actual use time". The write model (`Track`) stays the plain row that is
validated and stored; the full song remains at `/songs/{id}`. The same
split carries the license: the view joins the `licenses` row and the
response exposes a `LicenseSummary` (`state`, `updated_at`, `expires_at`,
`allowed_events`), so "all tracks of a scene, including licensing status"
is still one query.

### The license is its own row; the history is append-only

The sources on workflow storage agree on one shape: keep the current state
as a mutable projection on the aggregate and record every transition as an
immutable row (`from_state`, `to_state`, sequence, who, when, note), written
in the same transaction, and never derive the current state from the log on
every read
([Field Notes, audit-first](https://bysixteen.github.io/field-notes/platform/audit-first),
[moffhub/flow](https://packagist.org/packages/moffhub/flow),
[DEV, stop updating rows](https://dev.to/kingsleyonoh/the-compliance-problem-that-disappears-when-you-stop-updating-rows-4o1i)).
Here the projection is the `licenses` table, one row per track with a
_shared primary key_ (`licenses.track_id` is both the PK and the composite
foreign key to `tracks`), and the log is `license_events`. A row of its own,
rather than columns on `tracks`, keeps the licence's fields (`version`,
`expires_at`, and later fee, territory and media) together and leaves the
track as the plain cue. The migration backfills a `pending` row for every
existing track and the track adapter inserts track and license in one
transaction, so "every track has a license" holds and the view can use an
inner join.

Concurrency is optimistic: `version` counts applied events, a transition is
`UPDATE licenses … WHERE version = <read>` plus the event insert with
`seq = version + 1`, and `UNIQUE (track_id, seq)` is the safety net, the
same pair event stores use
([OneUptime, event store design](https://oneuptime.com/blog/post/2026-01-30-event-store-design/view),
[kindatechnical, event sourcing with PostgreSQL](https://kindatechnical.com/postgresql/implementing-event-sourcing-with-postgresql.html)).
A client may send `expected_state` to make its own read part of the check.

### Transitions are custom methods, not a writable `state`

Google's AIP-216 and the community AEP-216 say the same thing: the field is
called `state` (not `status`, reserved for HTTP), it is output-only, and
"APIs must not allow a State enum to be directly updated through an update
method; instead use custom state transition methods" that return the
resource
([AIP-216](https://google.aip.dev/216), [AEP-216](https://aep.dev/216),
[AIP-136](https://aip-dev.github.io/aip.dev/136)). Hence
`POST /tracks/{id}/license/{event}` with the event in the path, a body that
only carries what is optional, and the updated track as the answer. The
response embeds `allowed_events` so the UI offers exactly the legal moves
without copying the table.

On the status of a disallowed transition the two guides part ways: AIP-216
prescribes `FAILED_PRECONDITION` (HTTP 400) while AEP-216 keeps 400 for
malformed requests. This API already splits 400 (invalid body, query or
path), 409 (conflict with what is persisted) and 422 (a well-formed request
a domain rule refuses), so an event the state does not allow is
`422 LICENSE_INVALID_TRANSITION` and a stale read is
`409 LICENSE_STATE_STALE`.

### Who moved the license: actor and source

Every step is recorded by ACME staff (the rights holder has no account, see
"Rights holders are counterparties, not users"), but not every step is
ACME's decision. The event therefore carries two things: the `actor`, the
user who recorded it, with a snapshot of the name so the history reads the
same if the account is renamed, and the `source`, who decided. The defaults
follow how a sync deal runs: ACME sends the request and reopens a rejected
one; the holder answers, approves or declines
([RouteNote, negotiating a sync license](https://licensing.routenote.com/blog/how-to-negotiate-a-sync-music-license/),
[Audiosocket, clearance terminology](https://blog.audiosocket.com/blog/demystifying-music-clearance-terminology/)).
A client can override `acme`/`rights_holder` but never `system`, which is
reserved for the sweep and comes with no actor. The audit guidance also
records the actor type (user versus automated engine) for the same reason.

### Expiry is a stored date and a sweep

A sync deal is scoped by term, territory and media, with the fee rising
with the scope
([Synchtank](https://www.synchtank.com/synchblog/what-is-sync-licensing),
[Promise Legal](https://blog.promise.legal/sync-licensing-basics-musicians/),
[Third Chair](https://usethirdchair.com/blog/music-sync-license-terms-every-rights-holder-should-negotiate)).
The term is the one that changes the state, so `approve` stores `expires_at`.
Systems with a TTL combine lazy checks on read with a periodic sweep
([Cachex, expiring records](https://hexdocs.pm/cachex/expiring-records.html),
[Redis, lazy and active expiration](https://oneuptime.com/blog/post/2026-03-31-redis-how-redis-key-expiration-algorithm-works-lazy-active/view));
here the state is _stored_, not computed on read, because expiring must leave
an event in the history and will have to reach the real-time channel. The
sweep runs in `Container::spawn_background` like the IAM credential cleanup,
every `LICENSE_EXPIRY_SWEEP_INTERVAL` with the first pass at startup, and is
idempotent through the version guard: a manual `expire` that lands first
simply makes the sweep skip that row. `expires_at` is also exposed so the UI
can warn before the date.

### The event log is the outbox

For real-time delivery the reliable pattern is to write the event in the
same transaction and use a notification only as a low-latency wake-up:
`LISTEN/NOTIFY` on its own drops notifications when nobody is listening and
does not cross PgBouncer in transaction mode
([outbox-postgres](https://docs.rs/crate/outbox-postgres/latest),
[pg-trx-outbox](https://www.github.com/darky/pg-trx-outbox),
[Level Up, outboxing with Postgres notifications](https://levelup.gitconnected.com/transactional-outboxing-with-postgres-push-notifications-5cebdad893fd)).
`license_events` is that outbox (id, per-license sequence, tenant-wide
position, time), and every state change, from a request or from the sweep,
goes through one method of `LicenseService`, which is where the
`EventPublisher` port is called once the transaction has committed. The
notes below cover the delivery side.

Documented extension, not built: fee, territory and media as columns of
`licenses`.

### The cue is frozen while its license is active

A sync quote describes one concrete use: the scene, the kind of use, the
duration and the timing, then term, territory and media (the Wise Music
request form above), and the signed quote "serves as a temporary
authorization for the use"
([Hypebot, the life cycle of a sync placement](https://www.hypebot.com/hypebot/2023/08/the-life-cycle-of-a-sync-placement.html)).
Swap the song or move the cue and the authorization does not travel with
the track. So while the license is `requested`, `negotiating` or `approved`
(`LicenseState::is_active`), the fields that describe the use (`song_id`,
`start_ms`, `end_ms`, `usage`) are frozen and the track cannot be removed,
nor can the scene or movie that contains it: `PUT`/`DELETE /tracks/{id}`
answer 409 `TRACK_LOCKED_BY_LICENSE`, `DELETE /scenes/{id}` and `DELETE
/movies/{id}` answer 409 `SCENE_HAS_ACTIVE_LICENSES` /
`MOVIE_HAS_ACTIVE_LICENSES` with the track ids. `reject` and `expire` are
always available from an active state, so every track has a way out, and
`pending`, `rejected` and `expired` leave it free. A `PUT` that repeats the
stored values is not a change and succeeds. The service checks the state
it read, and the adapters repeat the check inside the `UPDATE`/`DELETE`
(`AND NOT EXISTS (… licenses … state IN ('requested', 'negotiating',
'approved'))`, the list kept next to the enum as `ACTIVE_STATES_SQL`), so a
transition committing between the check and the write still wins; a write
that touched no row is re-read to tell "locked" from "gone". The external
review of 2026-11-01 found the gap: a `movies:write` user could change the
song, timing and usage of an approved cue and keep the approval.

### Server-Sent Events over the event log

The spec fixes what a stream can rely on: messages are `field: value` lines
ended by a blank line; a block without `data` is not dispatched, which is
what makes `retry` and comment lines free to send; `id` stays set until the
next one and comes back as `Last-Event-ID` when the browser reconnects; a
status other than 200 or a content type other than `text/event-stream`
fails the connection without retries; and a comment "every 15 seconds or
so" keeps legacy proxies from dropping an idle connection
([WHATWG HTML, server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)).
Two consequences shape the implementation: heartbeats never carry an `id`,
because an id on a heartbeat would overwrite the client's resume cursor
([replayd](https://github.com/aleju03/replayd),
[KubeMQ events store](https://docs.kubemq.io/connectors/cloudevents/how-to/events-store)),
and 401/403/400 stay ordinary JSON replies so a browser without a valid
session stops instead of reconnecting in a loop.

`EventSource` cannot set request headers
([W3C bug 25984](https://www.w3.org/Bugs/Public/show_bug.cgi?id=25984)).
The options are a session cookie, `fetch` with a `ReadableStream` (which
reimplements reconnection and `Last-Event-ID` on the client) or a token in
the query string, an anti-pattern because it lands in logs, history and
`Referer`
([SSE with fetch and ReadableStream](https://dev.to/ohugonnot/sse-with-fetch-readablestream-authenticated-streaming-without-eventsource-604),
[Stack Overflow 42830312](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/42830312/how-can-i-set-sse-request-authorization-header)).
The middleware already fell back to the access cookie, the login already set
it and CORS already allowed credentials, so the native API works unchanged;
a short-lived "stream ticket" endpoint is the documented alternative for a
deployment that cannot use cookies. `Last-Event-ID` is not CORS-safelisted
yet (WHATWG fetch PR 1788 proposes it; [WebKit 289396](https://bugs.webkit.org/show_bug.cgi?id=289396)
and [Mozilla 1952605](https://bugzilla.mozilla.org/show_bug.cgi?id=1952605)
discuss it, and Firefox has preflighted on `Cache-Control`), so the CORS
configuration allows both headers rather than depend on the browser.

The frame encoder is forty lines of the crate (`events/sse.rs`) instead of
a dependency: `actix-web-lab` and the `actix-sse` crate extracted from it
offer `Sse::from_stream` with keep-alive, but the format is five fields and
owning it keeps the id-less heartbeat, the initial `retry`, the maximum
connection age and the shutdown behaviour in one tested place.

### Resuming from `Last-Event-ID` needs commit order

A `bigserial` or identity value is handed out inside the transaction, not at
commit. Two concurrent transitions can therefore commit in the opposite
order of their positions, and a reader asking for "everything after N" right
in between skips the lower one for good
([Dudycz, ordering in Postgres outbox](https://event-driven.io/en/ordering_in_postgres_outbox/),
[Yugabyte, no-gap sequence](https://dev.to/yugabyte/no-gap-sequence-in-postgresql-and-yugabytedb-3feo)).
The remedies are a snapshot-based cursor (`pg_snapshot_xmin`) or an
advisory lock taken right before the number is assigned, so numbers follow
commit order
([pgsql-hackers, sequences and serial order](https://www.postgresql.org/message-id/CACjxUsMKA6k-mDOdkos3k0i-KE4HFRwkd=PXPArYy4UabTd-LA@mail.gmail.com)).
The replay here is per tenant, so serializing per tenant is enough:
`apply` takes `pg_advisory_xact_lock(1, hashtext(tenant_id))` before the
`INSERT … RETURNING position`; the lock is released at commit, the next
insert of the tenant gets its position after that, and `position > N` is
exact. Transitions of one tenant are serialized (they already were per track
by the version guard); tenants never wait on each other. The replay is
bounded (`SSE_REPLAY_LIMIT`) and says so with `resync` rather than stall on
a client that was away for weeks; `scenes.position` set the precedent for
the column name.

The same property is what lets the live phase read the table instead of
trusting the bus. Publication happens after the commit and outside the
lock, so two transitions can be announced in the reverse of their
positions; but a read of `position > last` after any announcement returns
every committed event in order and can never jump over one still
committing (its position is lower, so under the lock it committed first).
The external review of 2026-11-01 caught the earlier live phase, which
forwarded the announced payload and dropped positions at or below the
cursor, losing the lower event of such a pair for good;
`crates/licensing/tests/concurrency.rs` holds the announcement of one
transition while a later one goes through and checks that both arrive, in
position order.

### One bus, two transports

`tokio::sync::broadcast` is the in-process fan-out: a receiver sees only
what was sent after it subscribed, a slow receiver gets `Lagged(n)` and
continues from the oldest retained value, and every value is cloned per
receiver
([tokio broadcast](https://docs.rs/tokio/latest/tokio/sync/broadcast/index.html)).
Hence the order of operations when a stream opens: subscribe first, then
read the replay, then go live. Live, a received value is only a wake-up.
PostgreSQL documents the same pattern for `NOTIFY`: the event "essentially
means, 'I changed this table, take a look at it to see what's new'", with
large payloads kept in a table and only the key sent
([PostgreSQL, NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)).
The stream reads `license_events` after its cursor and emits the rows, so
`Lagged` costs one bigger read, never a `resync`, and a burst of values
costs one read rather than one per value. The price is one query per
wake-up and stream; a shared reader per tenant is the documented extension
should streams per instance ever grow.

Redis pub/sub does not persist or retry: a subscriber that is not connected
misses the message
([Redis, pub/sub](https://redis.io/docs/latest/develop/interact/pubsub/)).
That is the right tool for a wake-up whose truth lives elsewhere, and it is
why the same `EventPublisher` port has two adapters: the bus itself for one
instance, and `RedisPublisher` plus a subscriber task per instance when
there are many. With Redis every instance, the publishing one included,
hears transitions through the channel, so there is one path and one order.
The `redis` crate's `aio::PubSub` stream ends when the connection drops and
does not resubscribe, so the subscriber is a loop with exponential backoff;
publishing goes through a `ConnectionManager`, which reconnects on its own
([redis::Client](https://docs.rs/redis/latest/redis/struct.Client.html),
[redis::aio::PubSub](https://docs.rs/redis/latest/redis/aio/struct.PubSub.html),
[pub/sub with redis-rs](https://redis.io/docs/latest/develop/use-cases/pub-sub/rust/)).
`LISTEN/NOTIFY` would have been the Postgres-native wake-up, with the same
at-most-once semantics; Redis was chosen because the challenge asks for it
and because it keeps the notification path off the transactional pool.

### A stream outlives its token

The middleware validates the session once, when the stream opens, and the
`AuthContext` it stores carries no expiry. Left alone, a stream would keep
delivering a tenant's events after the access token expired or the session
was revoked. The stream therefore closes itself after
`SSE_MAX_CONNECTION_AGE`, aligned with `JWT_ACCESS_TOKEN_TTL`: `EventSource`
reconnects immediately with the current cookie and `Last-Event-ID`, the
middleware re-checks user, tenant and session, and nothing is lost on the
way. The same token that stops background jobs on SIGTERM closes open
streams, so a graceful shutdown with browsers connected is immediate rather
than a wait for `SHUTDOWN_TIMEOUT`.

Documented extensions, not built: a `?movie_id=` filter on the stream (the
client filters by `track.movie_id` today); `track.created` / `track.updated`
/ `track.deleted` messages so lists stay in sync without a reload (not
replayable: tracks have no event log); a shared worker so many tabs of one
user hold a single connection; and a snapshot-based cursor should
per-tenant serialization ever become the bottleneck.

### Known concurrency gaps (review of 2026-11-01)

Two findings of the external review are recorded here with their fix
direction rather than fixed: each needs a lock across two services or a
schema-level guard, and neither was worth the risk before the demo. The
whole review is in [review-2026-11-01.md](review-2026-11-01.md).

- **Scene window against track insert.** `SceneService::update` checks
  `outside_window` and then writes the scene; `TrackService::create` checks
  the window and then inserts the track. Interleaved between check and
  write, the two leave a track outside the new window. Direction: the track
  insert takes the scene row `FOR SHARE` in its transaction and the scene
  update takes it `FOR UPDATE`; those row locks conflict with each other and
  not among readers, so one of the two waits and re-checks
  ([PostgreSQL, row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)).
- **Partial updates are full-row writes.** `PUT /movies/{id}` (and scenes,
  songs, tracks) merges the body into the row read a moment earlier and
  writes every column back, so two concurrent partial updates of different
  fields keep only the last one. Direction: an optimistic guard on
  `updated_at` (`WHERE updated_at = $read`, 409 on a miss, the etag pattern
  of [AIP-154](https://google.aip.dev/154)), or `SET col = COALESCE($n,
col)` so only the fields sent are written.
