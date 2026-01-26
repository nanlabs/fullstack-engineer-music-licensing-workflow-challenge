# API Testing Examples

## Base URL
All endpoints use: `http://localhost:3000/api` (API prefix is configurable via `API_PREFIX` environment variable)

## Health Checks

### Check overall health
```bash
curl -X GET http://localhost:3000/api/health
```

### Check database health
```bash
curl -X GET http://localhost:3000/api/health/database
```

### Check readiness probe (Kubernetes)
```bash
curl -X GET http://localhost:3000/api/health/ready
```

### Check liveness probe (Kubernetes)
```bash
curl -X GET http://localhost:3000/api/health/live
```

---

## Movies Endpoints

### 1. Create a Movie
```bash
curl -X POST http://localhost:3000/api/movies \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Epic Adventure",
    "description": "An epic journey through time and space",
    "director": "John Director",
    "releaseYear": 2024
  }'
```

### 2. Get All Movies
```bash
curl -X GET http://localhost:3000/api/movies
```

### 3. Get Movie by ID
```bash
curl -X GET http://localhost:3000/api/movies/{MOVIE_ID}
```

### 4. Update a Movie
```bash
curl -X PATCH http://localhost:3000/api/movies/{MOVIE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Movie Title",
    "releaseYear": 2025
  }'
```

### 5. Delete a Movie
```bash
curl -X DELETE http://localhost:3000/api/movies/{MOVIE_ID}
```

---

## Scenes Endpoints

### 1. Create a Scene
```bash
curl -X POST http://localhost:3000/api/scenes \
  -H "Content-Type: application/json" \
  -d '{
    "movieId": "{MOVIE_ID}",
    "title": "Opening Scene",
    "description": "The hero embarks on their journey",
    "sceneNumber": 1,
    "startTime": 0,
    "endTime": 180
  }'
```

### 2. Get All Scenes
```bash
# Get all scenes with pagination
curl -X GET "http://localhost:3000/api/scenes?page=1&limit=10"

# Get all scenes (uses default pagination)
curl -X GET http://localhost:3000/api/scenes
```

### 3. Get Scenes by Movie ID
```bash
# Filter scenes by movie ID (returns array, not paginated)
curl -X GET "http://localhost:3000/api/scenes?movieId={MOVIE_ID}"

# Note: When using movieId filter, pagination parameters (page, limit) are ignored
```

### 4. Get Scene by ID
```bash
curl -X GET http://localhost:3000/api/scenes/{SCENE_ID}
```

### 5. Update a Scene
```bash
curl -X PATCH http://localhost:3000/api/scenes/{SCENE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Scene Title",
    "sceneNumber": 2
  }'
```

### 6. Delete a Scene
```bash
curl -X DELETE http://localhost:3000/api/scenes/{SCENE_ID}
```

---

## Songs Endpoints

### 1. Create a Song
```bash
curl -X POST http://localhost:3000/api/songs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Epic Theme",
    "artist": "The Orchestra",
    "album": "Movie Soundtracks",
    "genre": "Orchestral",
    "duration": 180,
    "rightsHolder": "Epic Music Records"
  }'
```

### 2. Get All Songs
```bash
curl -X GET http://localhost:3000/api/songs
```

### 3. Get Song by ID
```bash
curl -X GET http://localhost:3000/api/songs/{SONG_ID}
```

### 4. Update a Song
```bash
curl -X PATCH http://localhost:3000/api/songs/{SONG_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Song Title",
    "duration": 200
  }'
```

### 5. Delete a Song
```bash
curl -X DELETE http://localhost:3000/api/songs/{SONG_ID}
```

---

## Tracks Endpoints

### 1. Create a Track
```bash
curl -X POST http://localhost:3000/api/tracks \
  -H "Content-Type: application/json" \
  -d '{
    "sceneId": "{SCENE_ID}",
    "songId": "{SONG_ID}",
    "startTime": 0,
    "endTime": 180
  }'
```

### 2. Get All Tracks
```bash
# Get all tracks with pagination
curl -X GET "http://localhost:3000/api/tracks?page=1&limit=10"

# Get all tracks (uses default pagination)
curl -X GET http://localhost:3000/api/tracks
```

### 3. Get Tracks by Scene ID
```bash
# Filter tracks by scene ID (returns array, not paginated)
curl -X GET "http://localhost:3000/api/tracks?sceneId={SCENE_ID}"

# Note: When using sceneId filter, pagination parameters are ignored
```

### 4. Get Tracks by Movie ID
```bash
# Filter tracks by movie ID (returns array, not paginated)
curl -X GET "http://localhost:3000/api/tracks?movieId={MOVIE_ID}"

# Note: When using movieId filter, pagination parameters are ignored. 
# sceneId takes precedence over movieId if both are provided.
```

### 5. Get Track by ID (with Licensing History)
```bash
curl -X GET http://localhost:3000/api/tracks/{TRACK_ID}
```

### 6. Update Licensing Status
```bash
curl -X PATCH http://localhost:3000/api/tracks/{TRACK_ID}/licensing-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "negotiating",
    "notes": "Negotiating terms with rights holder",
    "updatedBy": "admin"
  }'
```

**Available statuses:** `pending`, `negotiating`, `approved`, `rejected`, `expired`

**Important Notes:**
- Status updates are transactional and create a new entry in the licensing status history
- Updating to the same status will return a 400 error: "Track is already in {status} status"
- The track's `currentLicensingStatus` field is automatically updated
- Real-time SSE events are emitted for status changes

### 7. Delete a Track
```bash
curl -X DELETE http://localhost:3000/api/tracks/{TRACK_ID}
```

---

## Real-Time Events Endpoints

### Subscribe to Real-Time Events (SSE)
```bash
# Connect to all real-time events
curl -N http://localhost:3000/api/realtime/events

# Filter by event type (licensing status updates only)
curl -N "http://localhost:3000/api/realtime/events?eventType=licensing_status_update"

# Filter by track ID
curl -N "http://localhost:3000/api/realtime/events?trackId={TRACK_ID}"

# Filter by scene ID
curl -N "http://localhost:3000/api/realtime/events?sceneId={SCENE_ID}"

# Filter by movie ID
curl -N "http://localhost:3000/api/realtime/events?movieId={MOVIE_ID}"

# Multiple filters
curl -N "http://localhost:3000/api/realtime/events?eventType=licensing_status_update&movieId={MOVIE_ID}"
```

**Note:** The SSE stream will automatically emit events when licensing status changes occur. See [SSE Usage Guide](./SSE_USAGE.md) for client integration examples.

---

## Complete Workflow Example

Here's a complete workflow from creating a movie to updating licensing status:

```bash
# 1. Create a Movie
MOVIE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/movies \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Epic Adventure",
    "director": "John Director",
    "releaseYear": 2024
  }')
MOVIE_ID=$(echo $MOVIE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 2. Create a Scene
SCENE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/scenes \
  -H "Content-Type: application/json" \
  -d "{
    \"movieId\": \"$MOVIE_ID\",
    \"title\": \"Opening Scene\",
    \"sceneNumber\": 1,
    \"startTime\": 0,
    \"endTime\": 180
  }")
SCENE_ID=$(echo $SCENE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 3. Create a Song
SONG_RESPONSE=$(curl -s -X POST http://localhost:3000/api/songs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Epic Theme",
    "artist": "The Orchestra"
  }')
SONG_ID=$(echo $SONG_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 4. Create a Track
TRACK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tracks \
  -H "Content-Type: application/json" \
  -d "{
    \"sceneId\": \"$SCENE_ID\",
    \"songId\": \"$SONG_ID\",
    \"startTime\": 0,
    \"endTime\": 180
  }")
TRACK_ID=$(echo $TRACK_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 5. Update Licensing Status to Negotiating
curl -X PATCH http://localhost:3000/api/tracks/$TRACK_ID/licensing-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "negotiating",
    "notes": "Starting negotiations",
    "updatedBy": "admin"
  }'

# 6. Update Licensing Status to Approved
curl -X PATCH http://localhost:3000/api/tracks/$TRACK_ID/licensing-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "License approved and signed",
    "updatedBy": "admin"
  }'

# 7. Get Track with Full History
curl -X GET http://localhost:3000/api/tracks/$TRACK_ID
```
