# Database Entity Relationship (DER) Diagram

## 📊 Database Schema

```
┌─────────────────┐
│     MOVIES      │
├─────────────────┤
│ id (PK)         │
│ title           │
│ description     │
│ director        │
│ releaseYear     │
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐
│     SCENES      │
├─────────────────┤
│ id (PK)         │
│ movieId (FK)────┼──┐
│ title           │  │
│ description     │  │
│ sceneNumber     │  │
│ startTime       │  │
│ endTime         │  │
│ createdAt       │  │
│ updatedAt       │  │
└────────┬────────┘  │
         │           │
         │ 1:N       │
         │           │
         ▼           │
┌─────────────────┐  │
│     TRACKS      │  │
├─────────────────┤  │
│ id (PK)         │  │
│ sceneId (FK)────┼──┼──┐
│ songId (FK)─────┼──┼──┼──┐
│ startTime       │  │  │  │
│ endTime         │  │  │  │
│ currentStatus   │  │  │  │
│ createdAt       │  │  │  │
│ updatedAt       │  │  │  │
└────────┬────────┘  │  │  │
         │           │  │  │
         │ 1:N       │  │  │
         │           │  │  │
         ▼           │  │  │
┌─────────────────┐  │  │  │
│ LICENSING_      │  │  │  │
│ STATUSES        │  │  │  │
├─────────────────┤  │  │  │
│ id (PK)         │  │  │  │
│ trackId (FK)────┼──┘  │  │
│ status          │     │  │
│ notes           │     │  │
│ updatedBy       │     │  │
│ createdAt       │     │  │
└─────────────────┘     │  │
                        │  │
                        │  │
┌─────────────────┐     │  │
│     SONGS       │     │  │
├─────────────────┤     │  │
│ id (PK)         │     │  │
│ title           │     │  │
│ artist          │     │  │
│ album           │     │  │
│ genre           │     │  │
│ duration        │     │  │
│ rightsHolder    │     │  │
│ createdAt       │     │  │
│ updatedAt       │     │  │
└─────────────────┘     │  │
                        │  │
                        └──┘
                      (N:1 relationship)
```

## Entity Relationships

- **Movie** → **Scene** (1:N) - One movie has many scenes
- **Scene** → **Track** (1:N) - One scene has many tracks
- **Song** → **Track** (1:N) - One song can be used in many tracks
- **Track** → **LicensingStatus** (1:N) - One track has a history of status changes

## Licensing States

The licensing status follows this state flow:

```
pending → negotiating → approved
                    ↘ rejected
                    ↘ expired
```

### State Descriptions

- **pending**: Initial state when a track is created, awaiting licensing request
- **negotiating**: License terms are being negotiated with the rights holder
- **approved**: License has been approved and granted
- **rejected**: License request has been rejected
- **expired**: License has expired and needs renewal

## Field Descriptions

### Movies
- `id`: Unique identifier (UUID)
- `title`: Movie title
- `description`: Movie description
- `director`: Director name
- `releaseYear`: Year of release
- `createdAt`: Timestamp when record was created
- `updatedAt`: Timestamp when record was last updated

### Scenes
- `id`: Unique identifier (UUID)
- `movieId`: Foreign key to Movies table
- `title`: Scene title
- `description`: Scene description
- `sceneNumber`: Scene number in the movie
- `startTime`: Start time in seconds
- `endTime`: End time in seconds
- `createdAt`: Timestamp when record was created
- `updatedAt`: Timestamp when record was last updated

### Songs
- `id`: Unique identifier (UUID)
- `title`: Song title
- `artist`: Artist name
- `album`: Album name
- `genre`: Music genre
- `duration`: Song duration in seconds
- `rightsHolder`: Rights holder information
- `createdAt`: Timestamp when record was created
- `updatedAt`: Timestamp when record was last updated

### Tracks
- `id`: Unique identifier (UUID)
- `sceneId`: Foreign key to Scenes table
- `songId`: Foreign key to Songs table
- `startTime`: Start time of the track in the scene (seconds)
- `endTime`: End time of the track in the scene (seconds)
- `currentLicensingStatus`: Current licensing state (enum)
- `createdAt`: Timestamp when record was created
- `updatedAt`: Timestamp when record was last updated

### Licensing Statuses
- `id`: Unique identifier (UUID)
- `trackId`: Foreign key to Tracks table
- `status`: Licensing state at the time of this entry (enum)
- `notes`: Additional notes about the status change
- `updatedBy`: User/system that made the status change
- `createdAt`: Timestamp when status change occurred

## Constraints

- **Foreign Keys**: All foreign key relationships use CASCADE delete
- **Indexes**: 
  - `IDX_scenes_movieId` on Scenes.movieId
  - `IDX_tracks_sceneId` on Tracks.sceneId
  - `IDX_tracks_songId` on Tracks.songId
  - `IDX_licensing_statuses_trackId` on LicensingStatuses.trackId

## Data Flow

1. **Create Movie** → Creates a movie record
2. **Create Scene** → Associates scene with movie (validates movieId exists)
3. **Create Song** → Creates a song record
4. **Create Track** → Associates track with scene and song (validates both exist)
   - Automatically creates initial `pending` licensing status
5. **Update Licensing Status** → Creates new status entry and updates track's current status
   - Emits real-time SSE event for status change
