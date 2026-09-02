# API Flows — curl walkthrough

Complete, copy-pasteable `curl` flows for every persona in the platform, hitting
the real backend directly (no frontend). All requests assume the backend is
reachable at:

```bash
export API=http://localhost:8081/api
```

(Adjust the port to match your `docker compose` / `cargo run` setup — the
Docker Compose stack in this repo maps the backend to host port `8081`.)

All demo users share the password `abraxas12345`. Response bodies are JSON;
examples below use `jq` to extract tokens/ids for chaining requests — install
it or substitute manual copy/paste.

## Seeded users, roles & scopes

| Email | Name | Platform role | Scopes | Notes |
|---|---|---|---|---|
| `casey@studio.dev` | Casey Reyes | Producer | `movies:*`, `scenes:*`, `tracks:*`, `licenses:*`, `songs:read`, `labels:read` | Movie owner/supervisor persona |
| `jordan@studio.dev` | Jordan Blake | Producer | same as Casey | No seeded movie membership — add via API to test |
| `nova@indie.dev` | Nova Chen | Artist | `songs:*`, `licenses:read`, `licenses:negotiate`, `labels:read`, `movies:read`, `scenes:read`, `tracks:read` | Also a Wave Records `ARTIST` member (label rep/owner still resolve rights, not her, once she's under a label) |
| `priya@wavelabel.dev` | Priya Anand | Label Manager | same as Nova | Wave Records `OWNER` |
| `mateo@wavelabel.dev` | Mateo Ruiz | Label Manager | same as Nova | Wave Records `REP` |
| `sam@studio.dev` | Sam Okafor | Admin | `*` | Full access to everything |

Seeded label:

| Label | id |
|---|---|
| Wave Records | `00000000-0000-4000-c000-000000000001` |
| Indie Frequency | `00000000-0000-4000-c000-000000000002` |

User ids (deterministic, from migration `003_seed_users.up.sql`):

| Email | user_id |
|---|---|
| casey@studio.dev | `00000000-0000-4000-b000-000000000001` |
| jordan@studio.dev | `00000000-0000-4000-b000-000000000002` |
| nova@indie.dev | `00000000-0000-4000-b000-000000000003` |
| priya@wavelabel.dev | `00000000-0000-4000-b000-000000000004` |
| mateo@wavelabel.dev | `00000000-0000-4000-b000-000000000005` |
| sam@studio.dev | `00000000-0000-4000-b000-000000000006` |

**Rights holder resolution** (who can respond to a license negotiation for a
track): if the track's song has a `label_id`, only that label's `OWNER`/`REP`
members act as the rights holder (Priya or Mateo for Wave Records songs).
If the song has no label, the song's `artist_id` themself is the rights
holder (Nova, when her songs aren't attached to a label).

**Movie team** (who can create scenes/tracks/licenses for a movie): any
`MovieMember` with role `OWNER`, `SUPERVISOR`, or `EDITOR` (not `VIEWER`).

---

## 0. Auth basics

### Login

```bash
CASEY_TOKENS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@studio.dev","password":"abraxas12345"}')

CASEY_ACCESS=$(echo "$CASEY_TOKENS" | jq -r .access_token)
CASEY_REFRESH=$(echo "$CASEY_TOKENS" | jq -r .refresh_token)
```

Response shape (`TokenResponse`):
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### Get current profile

```bash
curl -s "$API/auth/me" -H "Authorization: Bearer $CASEY_ACCESS" | jq
```

### Refresh token

```bash
curl -s -X POST "$API/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$CASEY_REFRESH\"}" | jq
```

### Logout (single session) / logout-all

```bash
curl -s -X POST "$API/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$CASEY_REFRESH\"}" | jq

curl -s -X POST "$API/auth/logout-all" -H "Authorization: Bearer $CASEY_ACCESS" | jq
```

---

## Flow A — Casey (Producer) creates a movie, a scene, and places a track

```bash
export API=http://localhost:8081/api

# 1. Login as Casey
CASEY_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@studio.dev","password":"abraxas12345"}' | jq -r .access_token)

# 2. Create a movie (Casey becomes OWNER automatically)
MOVIE=$(curl -s -X POST "$API/movies" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
        "title": "Midnight Symphony",
        "description": "A neo-noir thriller set in a jazz club.",
        "release_year": 2027,
        "director": "Casey Reyes"
      }')
echo "$MOVIE" | jq
MOVIE_ID=$(echo "$MOVIE" | jq -r .id)

# 3. Create a scene in that movie
SCENE=$(curl -s -X POST "$API/scenes" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{
        \"movie_id\": \"$MOVIE_ID\",
        \"title\": \"Opening Blackout\",
        \"scene_number\": 1,
        \"description\": \"The city goes dark as the club's band keeps playing.\",
        \"start_time\": 0,
        \"end_time\": 60
      }")
echo "$SCENE" | jq
SCENE_ID=$(echo "$SCENE" | jq -r .id)

# 4. List my movies (movies/me — filtered to created_by = caller)
curl -s "$API/movies/me" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 5. Search/browse songs to find one to place (needs songs:read, which Producer has)
curl -s "$API/songs?search=Blackout" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# (Assume a song already exists — see Flow B to have Nova create one first.
#  Substitute its id below.)
SONG_ID="<song-id-from-flow-b>"

# 6. Place the song as a track in the scene
TRACK=$(curl -s -X POST "$API/tracks" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{
        \"scene_id\": \"$SCENE_ID\",
        \"song_id\": \"$SONG_ID\",
        \"usage_type\": \"BACKGROUND\",
        \"start_time_seconds\": 0,
        \"end_time_seconds\": 60,
        \"notes\": \"Fades in under dialogue.\"
      }")
echo "$TRACK" | jq
TRACK_ID=$(echo "$TRACK" | jq -r .id)

# 7. Check the track's license (should be null — none requested yet)
curl -s "$API/tracks/$TRACK_ID/license" -H "Authorization: Bearer $CASEY_ACCESS" | jq
```

### Add Jordan to the movie team

```bash
# user_id for jordan@studio.dev
JORDAN_ID="00000000-0000-4000-b000-000000000002"

curl -s -X POST "$API/movies/$MOVIE_ID/members" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$JORDAN_ID\", \"role\": \"EDITOR\"}" | jq

curl -s "$API/movies/$MOVIE_ID/members" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# Remove Jordan again
curl -s -X DELETE "$API/movies/$MOVIE_ID/members/$JORDAN_ID" \
  -H "Authorization: Bearer $CASEY_ACCESS" | jq
```

---

## Flow B — Nova (Artist) creates a song (independent, no label)

```bash
NOVA_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nova@indie.dev","password":"abraxas12345"}' | jq -r .access_token)

NOVA_ID="00000000-0000-4000-b000-000000000003"

SONG=$(curl -s -X POST "$API/songs" \
  -H "Authorization: Bearer $NOVA_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{
        \"title\": \"Blackout Serenade\",
        \"artist_id\": \"$NOVA_ID\",
        \"album\": \"Neon Nights\",
        \"duration_seconds\": 210,
        \"genre\": \"Jazz\",
        \"isrc\": \"US-S1Z-27-00001\"
      }")
echo "$SONG" | jq
SONG_ID=$(echo "$SONG" | jq -r .id)

# List Nova's own songs
curl -s "$API/artists/$NOVA_ID/songs" -H "Authorization: Bearer $NOVA_ACCESS" | jq

# Update the song
curl -s -X PUT "$API/songs/$SONG_ID" \
  -H "Authorization: Bearer $NOVA_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"genre": "Neo-Jazz"}' | jq

# See which tracks (placements) use this song
curl -s "$API/songs/$SONG_ID/tracks" -H "Authorization: Bearer $NOVA_ACCESS" | jq
```

---

## Flow C — Song under a label (Priya creates it for Nova via Wave Records)

Any caller with `songs:write` can create a song for any `artist_id` — the
label attribution is what routes negotiation rights to the label instead of
the artist.

```bash
PRIYA_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@wavelabel.dev","password":"abraxas12345"}' | jq -r .access_token)

NOVA_ID="00000000-0000-4000-b000-000000000003"
WAVE_LABEL_ID="00000000-0000-4000-c000-000000000001"

SONG=$(curl -s -X POST "$API/songs" \
  -H "Authorization: Bearer $PRIYA_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{
        \"title\": \"Neon Pulse\",
        \"artist_id\": \"$NOVA_ID\",
        \"label_id\": \"$WAVE_LABEL_ID\",
        \"album\": \"Synthwave Dreams\",
        \"duration_seconds\": 195,
        \"genre\": \"Electronic\"
      }")
echo "$SONG" | jq
SONG_ID=$(echo "$SONG" | jq -r .id)
```

Any subsequent license negotiation for a track using this song routes to
Wave Records (Priya/Mateo), **not** Nova directly, because `label_id` is set.

---

## Flow D — Label management (Priya, Wave Records owner)

```bash
PRIYA_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@wavelabel.dev","password":"abraxas12345"}' | jq -r .access_token)

WAVE_LABEL_ID="00000000-0000-4000-c000-000000000001"

# Create a brand-new label (any songs:write... actually labels:write caller)
LABEL=$(curl -s -X POST "$API/labels" \
  -H "Authorization: Bearer $PRIYA_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Indie Frequency Two",
        "website": "https://indiefrequency2.example",
        "contact_email": "hello@indiefrequency2.example"
      }')
echo "$LABEL" | jq
NEW_LABEL_ID=$(echo "$LABEL" | jq -r .id)

# List / search labels
curl -s "$API/labels" -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Get a single label
curl -s "$API/labels/$WAVE_LABEL_ID" -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Update a label
curl -s -X PUT "$API/labels/$WAVE_LABEL_ID" \
  -H "Authorization: Bearer $PRIYA_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"website": "https://waverecords.example/new"}' | jq

# Add a member (e.g. a new rep) — role: OWNER | REP | ARTIST (defaults to ARTIST if omitted)
SAM_ID="00000000-0000-4000-b000-000000000006"
curl -s -X POST "$API/labels/$WAVE_LABEL_ID/members" \
  -H "Authorization: Bearer $PRIYA_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$SAM_ID\", \"role\": \"REP\"}" | jq

# List members
curl -s "$API/labels/$WAVE_LABEL_ID/members" -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Remove a member
curl -s -X DELETE "$API/labels/$WAVE_LABEL_ID/members/$SAM_ID" \
  -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Which labels is a given user a member of?
NOVA_ID="00000000-0000-4000-b000-000000000003"
curl -s "$API/users/$NOVA_ID/labels" -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Songs under this label
curl -s "$API/labels/$WAVE_LABEL_ID/songs" -H "Authorization: Bearer $PRIYA_ACCESS" | jq

# Delete a label
curl -s -X DELETE "$API/labels/$NEW_LABEL_ID" -H "Authorization: Bearer $PRIYA_ACCESS" | jq
```

---

## Flow E — Full license negotiation (the core workflow)

Personas: **Casey** (movie team / requester) vs. **Nova** (rights holder, no
label) or **Mateo** (rights holder, Wave Records rep). This example uses a
Wave Records track (`Neon Pulse`, from Flow C) so **Mateo** is the
counterparty; swap in Nova's token if the song has no label.

State machine: `DRAFT → REQUESTED → APPROVED` (accepted) or
`REQUESTED → REJECTED` or `REQUESTED → CANCELLED` (movie team withdraws).
Offers ping-pong inside `REQUESTED`: each `counter` flips whose turn it is;
only the side that did **not** propose the latest offer may `accept`,
`reject`, or `counter` it again.

```bash
CASEY_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"casey@studio.dev","password":"abraxas12345"}' | jq -r .access_token)

MATEO_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mateo@wavelabel.dev","password":"abraxas12345"}' | jq -r .access_token)

TRACK_ID="<track-id-that-uses-the-labeled-song>"

# 1. Casey creates a DRAFT license request (movie team only)
# NOTE: the create response is nested — {"license": {...}, "offer": {...}} —
# unlike every other license endpoint, which returns the license flat.
LICENSE=$(curl -s -X POST "$API/licenses" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{
        \"track_id\": \"$TRACK_ID\",
        \"license_fee\": 2500,
        \"currency\": \"USD\",
        \"territory\": \"Worldwide\",
        \"media_rights\": \"Theatrical, Streaming\",
        \"exclusive\": false,
        \"notes\": \"Opening blackout scene, background cue.\"
      }")
echo "$LICENSE" | jq
LICENSE_ID=$(echo "$LICENSE" | jq -r .license.id)
# status: DRAFT

# 2. (Optional) Casey revises the draft terms before submitting
curl -s -X POST "$API/licenses/$LICENSE_ID/revise" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"license_fee": 3000, "currency": "USD", "territory": "Worldwide", "exclusive": false}' | jq

# 3. Casey submits the request — DRAFT -> REQUESTED, visible to the rights holder
curl -s -X POST "$API/licenses/$LICENSE_ID/submit" \
  -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 4. Mateo (rights holder) sees it and counters with a higher fee
curl -s -X POST "$API/licenses/$LICENSE_ID/counter" \
  -H "Authorization: Bearer $MATEO_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"license_fee": 4000, "currency": "USD", "territory": "Worldwide", "exclusive": false, "notes": "Our minimum for exclusive-free worldwide use."}' | jq

# 5. Casey counters back
curl -s -X POST "$API/licenses/$LICENSE_ID/counter" \
  -H "Authorization: Bearer $CASEY_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"license_fee": 3500, "currency": "USD", "territory": "Worldwide", "exclusive": false}' | jq

# 6a. Mateo accepts Casey's latest offer — REQUESTED -> APPROVED
curl -s -X POST "$API/licenses/$LICENSE_ID/accept" \
  -H "Authorization: Bearer $MATEO_ACCESS" | jq

#   -- OR --
# 6b. Mateo rejects instead — REQUESTED -> REJECTED (reason required)
curl -s -X POST "$API/licenses/$LICENSE_ID/reject" \
  -H "Authorization: Bearer $MATEO_ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Fee is below our minimum for this usage."}' | jq

#   -- OR --
# 6c. Casey withdraws the request instead — REQUESTED -> CANCELLED (movie team only)
curl -s -X POST "$API/licenses/$LICENSE_ID/cancel" \
  -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 7. Inspect the full offer history
curl -s "$API/licenses/$LICENSE_ID/offers" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 8. Get the license request itself
curl -s "$API/licenses/$LICENSE_ID" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 9. Look up the (most recent) license for a track directly
curl -s "$API/tracks/$TRACK_ID/license" -H "Authorization: Bearer $CASEY_ACCESS" | jq

# 10. Delete a DRAFT (never submitted) license request — movie team only
curl -s -X DELETE "$API/licenses/$LICENSE_ID" -H "Authorization: Bearer $CASEY_ACCESS" | jq
```

### Live negotiation events (SSE)

Either side can subscribe to a live stream of negotiation events
(`submitted`, `counter_offer`, `accepted`, `rejected`, `cancelled`):

```bash
curl -N "$API/licenses/events" -H "Authorization: Bearer $CASEY_ACCESS"
# streams: data: {"license_id":"...","track_id":"...","kind":"submitted","actor":"...","actor_name":"Casey Reyes","timestamp":"..."}
```

---

## Flow F — Sam (Admin) has unrestricted access

Admin's role scope is `['*']`, so every route below succeeds regardless of
movie/label membership.

```bash
SAM_ACCESS=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sam@studio.dev","password":"abraxas12345"}' | jq -r .access_token)

# Browse everything
curl -s "$API/movies" -H "Authorization: Bearer $SAM_ACCESS" | jq
curl -s "$API/songs" -H "Authorization: Bearer $SAM_ACCESS" | jq
curl -s "$API/labels" -H "Authorization: Bearer $SAM_ACCESS" | jq

# List / revoke own sessions
curl -s "$API/auth/sessions" -H "Authorization: Bearer $SAM_ACCESS" | jq
SESSION_ID=$(curl -s "$API/auth/sessions" -H "Authorization: Bearer $SAM_ACCESS" | jq -r '.[0].id')
curl -s -X DELETE "$API/auth/sessions/$SESSION_ID" -H "Authorization: Bearer $SAM_ACCESS" | jq
```

---

## Reference — all routes

Base path: `/api`. Auth: `Authorization: Bearer <access_token>` unless noted.
`*` scopes (Admin) satisfy every `require_scope` check below.

### Auth (`/api/auth`)

| Method | Path | Auth | Scope | Body |
|---|---|---|---|---|
| POST | `/auth/login` | none | — | `{email, password}` |
| POST | `/auth/refresh` | none | — | `{refresh_token}` |
| POST | `/auth/logout` | none | — | `{refresh_token}` |
| POST | `/auth/logout-all` | bearer | — | — |
| GET | `/auth/me` | bearer | — | — |
| GET | `/auth/sessions` | bearer | — | — |
| DELETE | `/auth/sessions/{id}` | bearer | — | — |

### Movies (`/api/movies`)

| Method | Path | Scope | Body |
|---|---|---|---|
| POST | `/movies` | `movies:write` | `CreateMovieRequest{title, description?, release_year?, director?}` |
| GET | `/movies?page=&page_size=&search=&created_by=` | `movies:read` | — |
| GET | `/movies/me` | `movies:read` | — (movies where `created_by = caller`) |
| GET | `/movies/{id}` | `movies:read` | — |
| PUT | `/movies/{id}` | `movies:write` | `UpdateMovieRequest{title?, description?, release_year?, director?}` |
| DELETE | `/movies/{id}` | `movies:delete` | — |
| POST | `/movies/{id}/members` | `movies:members` | `{user_id, role?}` (`OWNER`\|`SUPERVISOR`\|`EDITOR`\|`VIEWER`, default `EDITOR`) |
| GET | `/movies/{id}/members` | `movies:read` | — |
| DELETE | `/movies/{id}/members/{user_id}` | `movies:members` | — |
| GET | `/movies/{id}/scenes` | `scenes:read` | — |

### Scenes (`/api/scenes`)

| Method | Path | Scope | Body |
|---|---|---|---|
| POST | `/scenes` | `scenes:write` (+ movie-team check) | `CreateSceneRequest{movie_id, title, scene_number, description?, start_time, end_time}` |
| GET | `/scenes/{id}` | `scenes:read` | — |
| PUT | `/scenes/{id}` | `scenes:write` (+ movie-team check) | `UpdateSceneRequest{title?, scene_number?, description?, start_time?, end_time?}` |
| DELETE | `/scenes/{id}` | `scenes:delete` (+ movie-team check) | — |
| GET | `/scenes/{id}/tracks` | `tracks:read` | — |

### Tracks (`/api/tracks`)

| Method | Path | Scope | Body |
|---|---|---|---|
| POST | `/tracks` | `tracks:write` (+ movie-team check) | `CreateTrackRequest{scene_id, song_id, usage_type, start_time_seconds, end_time_seconds, notes?}` (`usage_type`: `BACKGROUND`\|`FEATURED`\|`CREDITS`\|`TRAILER`) |
| GET | `/tracks/{id}` | `tracks:read` | — |
| PUT | `/tracks/{id}` | `tracks:write` (+ movie-team check) | `UpdateTrackRequest{usage_type?, start_time_seconds?, end_time_seconds?, notes?}` |
| DELETE | `/tracks/{id}` | `tracks:delete` (+ movie-team check) | — |
| GET | `/tracks/{id}/license` | `licenses:read` | — (most recent license request for the track, any status, or `null`) |

### Songs (`/api/songs`, `/api/artists/{id}/songs`)

| Method | Path | Scope | Body |
|---|---|---|---|
| POST | `/songs` | `songs:write` | `CreateSongRequest{title, artist_id, label_id?, album?, duration_seconds, genre?, isrc?}` |
| GET | `/songs?page=&page_size=&search=&artist_id=&label_id=&genre=` | `songs:read` | — |
| GET | `/songs/{id}` | `songs:read` | — |
| PUT | `/songs/{id}` | `songs:write` | `UpdateSongRequest{title?, album?, genre?, isrc?, duration_seconds?}` |
| DELETE | `/songs/{id}` | `songs:delete` | — |
| GET | `/songs/{id}/tracks` | `tracks:read` | — |
| GET | `/artists/{id}/songs` | `songs:read` | — |

### Labels (`/api/labels`, `/api/users/{id}/labels`)

| Method | Path | Scope | Body |
|---|---|---|---|
| POST | `/labels` | `labels:write` | `CreateLabelRequest{name, website?, contact_email?}` |
| GET | `/labels` | `labels:read` | — |
| GET | `/labels/{id}` | `labels:read` | — |
| PUT | `/labels/{id}` | `labels:write` | `UpdateLabelRequest{name?, website?, contact_email?}` |
| DELETE | `/labels/{id}` | `labels:delete` | — |
| POST | `/labels/{id}/members` | `labels:members` | `{user_id, role?}` (`OWNER`\|`REP`\|`ARTIST`, default `ARTIST`) |
| GET | `/labels/{id}/members` | `labels:read` | — |
| DELETE | `/labels/{id}/members/{user_id}` | `labels:members` | — |
| GET | `/labels/{id}/songs` | `songs:read` | — |
| GET | `/users/{id}/labels` | `labels:read` | — |

### Licenses (`/api/licenses`)

| Method | Path | Scope | Who | Body |
|---|---|---|---|---|
| POST | `/licenses` | `licenses:write` | movie team | `CreateLicenseRequest{track_id, license_fee?, currency?, territory?, media_rights?, license_start?, license_end?, exclusive?, notes?}` — response is `{license, offer}`, not flat |
| GET | `/licenses/{id}` | `licenses:read` | either side | — |
| GET | `/licenses/{id}/offers` | `licenses:read` | either side | — |
| POST | `/licenses/{id}/revise` | `licenses:write` | movie team, status=DRAFT | `OfferTerms` (same fields as create, minus `track_id`) |
| POST | `/licenses/{id}/submit` | `licenses:write` | movie team, status=DRAFT | — |
| POST | `/licenses/{id}/counter` | `licenses:negotiate` | opposite side of latest offer, status=REQUESTED | `OfferTerms` |
| POST | `/licenses/{id}/accept` | `licenses:negotiate` | opposite side of latest offer, status=REQUESTED | — |
| POST | `/licenses/{id}/reject` | `licenses:negotiate` | opposite side of latest offer, status=REQUESTED | `{reason}` |
| POST | `/licenses/{id}/cancel` | `licenses:write` | movie team, status=REQUESTED | — |
| DELETE | `/licenses/{id}` | `licenses:delete` | movie team, status=DRAFT | — |
| GET | `/licenses/events` | bearer only | any authenticated user | — (SSE stream, `text/event-stream`) |

**Status transitions**: `DRAFT → REQUESTED` (submit) → `APPROVED` (accept) |
`REJECTED` (reject) | `CANCELLED` (cancel, movie team only). `revise` only
works in `DRAFT`. `counter`/`accept`/`reject` only work in `REQUESTED`, and
only for the side that did **not** propose the offer currently on the table.
