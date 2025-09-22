# API REST + GraphQL - Music Licensing Workflow

This project now supports both **REST API** and **GraphQL API** to access all resources in the music licensing system.

## 🚀 How to Run

```bash
npm run start:dev
```

Once running, you'll have access to:

- **REST API**: `http://localhost:3000`
- **GraphQL Playground**: `http://localhost:3000/graphql`
- **Swagger Documentation**: `http://localhost:3000/api`

## 📋 REST API

### Main Endpoints

#### Movies

- `GET /movies` - Get all movies
- `GET /movies/:id` - Get movie by ID
- `POST /movies` - Create new movie
- `PATCH /movies/:id` - Update movie

#### Scenes

- `GET /scenes` - Get all scenes
- `GET /scenes/:id` - Get scene by ID
- `GET /scenes?movieId=:id` - Get scenes by movie
- `POST /scenes` - Create new scene
- `PATCH /scenes/:id` - Update scene

#### Songs

- `GET /songs` - Get all songs
- `GET /songs/:id` - Get song by ID
- `GET /songs?q=:query` - Search songs by title, artist or album
- `POST /songs` - Create new song
- `PATCH /songs/:id` - Update song
- `DELETE /songs/:id` - Delete song

#### Tracks

- `GET /tracks` - Get all tracks
- `GET /tracks/:id` - Get track by ID
- `GET /tracks?sceneId=:id` - Filter tracks by scene
- `GET /tracks?movieId=:id` - Filter tracks by movie
- `POST /tracks` - Create new track
- `DELETE /tracks/:id` - Delete track

#### Licenses

- `POST /licenses/songs/:songId/status` - Update license status of a song
- `GET /licenses/songs/:songId/history` - Get license history of a song
- `GET /licenses/songs/:songId/current` - Get current license status of a song
- `POST /licenses/tracks/:trackId/song/status` - Update license status of song by track
- `GET /licenses/tracks/:trackId/song/current` - Get current license status of song by track

## 🔍 GraphQL API

### Available Queries

#### Movies

```graphql
# Get all movies
query {
  movies {
    id
    title
    description
    director
    releaseYear
    status
    scenes {
      id
      name
      sceneNumber
    }
  }
}

# Get specific movie
query {
  movie(id: "1") {
    id
    title
    description
    scenes {
      id
      name
      tracks {
        id
        name
        song {
          title
          artist
        }
      }
    }
  }
}

# Get movie statistics
query {
  movieWithStats(id: "1") {
    id
    title
    # Includes license statistics
  }
}
```

#### Scenes

```graphql
# Get all scenes
query {
  scenes {
    id
    name
    description
    sceneNumber
    durationSeconds
    movie {
      title
    }
  }
}

# Get scenes by movie
query {
  scenesByMovie(movieId: 1) {
    id
    name
    sceneNumber
    tracks {
      id
      name
    }
  }
}
```

#### Songs

```graphql
# Get all songs
query {
  songs {
    id
    title
    artist
    album
    releaseYear
    genre
    durationSeconds
    tracks {
      id
      name
    }
  }
}
```

#### Tracks

```graphql
# Get all tracks
query {
  tracks {
    id
    name
    startTimeSeconds
    endTimeSeconds
    notes
    scene {
      name
      movie {
        title
      }
    }
    song {
      title
      artist
    }
    currentLicenseStatus {
      status
      isActive
      createdAt
    }
  }
}

# Get tracks by scene
query {
  tracksByScene(sceneId: 1) {
    id
    name
    startTimeSeconds
    endTimeSeconds
  }
}

# Get tracks by movie
query {
  tracksByMovie(movieId: 1) {
    id
    name
    scene {
      name
    }
  }
}
```

#### Licenses

```graphql
# Get license history
query {
  licenseHistory(songId: "1") {
    id
    status
    isActive
    createdAt
    song {
      title
      artist
    }
  }
}

# Get current license status
query {
  currentLicenseStatus(songId: "1") {
    id
    status
    isActive
    createdAt
  }
}
```

### Available Mutations

#### Movies

```graphql
# Create movie
mutation {
  createMovie(
    createMovieInput: {
      title: "New Movie"
      description: "Movie description"
      director: "Director"
      releaseYear: 2024
      status: "development"
    }
  ) {
    id
    title
    createdAt
  }
}

# Update movie
mutation {
  updateMovie(id: "1", updateMovieInput: { title: "Updated Title", status: "production" }) {
    id
    title
    status
  }
}

# Delete movie
mutation {
  removeMovie(id: "1")
}
```

#### Scenes

```graphql
# Create scene
mutation {
  createScene(
    createSceneInput: {
      name: "Opening Scene"
      description: "First scene of the movie"
      sceneNumber: 1
      durationSeconds: 300
      movieId: 1
    }
  ) {
    id
    name
    sceneNumber
  }
}
```

#### Songs

```graphql
# Create song
mutation {
  createSong(
    createSongInput: {
      title: "New Song"
      artist: "Artist"
      album: "Album"
      releaseYear: 2023
      genre: "Rock"
      durationSeconds: 240
    }
  ) {
    id
    title
    artist
  }
}
```

#### Tracks

```graphql
# Create track
mutation {
  createTrack(
    createTrackInput: {
      name: "Background Track"
      startTimeSeconds: 10.5
      endTimeSeconds: 45.2
      notes: "Background music for the scene"
      sceneId: 1
      songId: 1
    }
  ) {
    id
    name
    startTimeSeconds
    endTimeSeconds
  }
}
```

#### Licenses

```graphql
# Update song license status
mutation {
  updateSongLicenseStatus(songId: "1", updateLicenseStatusInput: { status: APPROVED }) {
    id
    status
    createdAt
  }
}

# Update song license status by track
mutation {
  updateSongLicenseStatusByTrack(
    trackId: "1"
    updateLicenseStatusInput: {
      status: APPROVED
      notes: "License approved"
      updatedBy: "Admin"
      licenseFee: 500.00
      licenseStartDate: "2024-01-01T00:00:00Z"
      licenseEndDate: "2024-12-31T23:59:59Z"
    }
  ) {
    id
    status
    isActive
    createdAt
  }
}
```

## 🎯 Available License Statuses

- `PENDING` - Pending
- `IN_REVIEW` - In review
- `NEGOTIATING` - Negotiating
- `APPROVED` - Approved
- `REJECTED` - Rejected
- `EXPIRED` - Expired

## 🔄 WebSocket Updates

The system also includes real-time updates via WebSocket for license status changes:

```javascript
// JavaScript client
const socket = io('http://localhost:3000');

socket.on('licenseStatusUpdated', (data) => {
  console.log('License status updated:', data);
});
```

## ⚡ Advantages of Dual Implementation

### REST API

- ✅ Familiar to most developers
- ✅ Cacheable with HTTP
- ✅ Excellent for simple CRUD operations
- ✅ Compatibility with existing tools

### GraphQL API

- ✅ Single endpoint for all operations
- ✅ Flexible queries - request only the data you need
- ✅ Strong typing with introspection
- ✅ Excellent for complex relationships between entities
- ✅ Integrated playground for testing
- ✅ Ideal for modern frontend applications

## 🛠️ Development Tools

1. **GraphQL Playground**: `http://localhost:3000/graphql`

   - Explore schema
   - Execute queries and mutations
   - View auto-generated documentation

2. **Swagger UI**: `http://localhost:3000/api`
   - Complete REST API documentation
   - Endpoint testing
   - Request/response examples

## 📚 Usage Examples

### Use Case 1: React/Vue Frontend with GraphQL

```javascript
// Use Apollo Client or similar
const GET_MOVIE_WITH_TRACKS = gql`
  query GetMovieWithTracks($id: ID!) {
    movie(id: $id) {
      title
      scenes {
        name
        tracks {
          name
          song {
            title
            artist
          }
          currentLicenseStatus {
            status
          }
        }
      }
    }
  }
`;
```

### Use Case 2: REST Integration for Legacy Systems

```bash
# Update song license status
curl -X POST http://localhost:3000/licenses/songs/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "License approved",
    "licenseFee": 500.00
  }'

# Update song license status by track
curl -X POST http://localhost:3000/licenses/tracks/1/song/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "License approved",
    "licenseFee": 500.00
  }'
```

This implementation allows you to use the API that best fits your specific needs, maintaining flexibility and compatibility with different types of clients.
