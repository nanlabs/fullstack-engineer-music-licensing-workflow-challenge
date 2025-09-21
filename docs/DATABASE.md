# Database Schema Documentation

## Overview

The database is designed to support the music licensing workflow for ACME BROS PICTURES. It uses PostgreSQL with the following main entities:

## Entity Relationship Diagram

```
Movies (1) ──── (N) Scenes (1) ──── (N) Tracks (N) ──── (1) Songs
                                          │
                                          │
                                          │ (1)
                                          │
                                         (N)
                                    LicenseStatuses
```

## Tables

### movies
- `id` (UUID, Primary Key)
- `title` (VARCHAR(255), NOT NULL)
- `description` (TEXT)
- `director` (VARCHAR(100))
- `release_year` (INTEGER)
- `status` (VARCHAR(50), DEFAULT 'development')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### scenes
- `id` (UUID, Primary Key)
- `name` (VARCHAR(255), NOT NULL)
- `description` (TEXT)
- `scene_number` (INTEGER, NOT NULL)
- `duration_seconds` (INTEGER)
- `notes` (TEXT)
- `movie_id` (UUID, Foreign Key → movies.id)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### songs
- `id` (UUID, Primary Key)
- `title` (VARCHAR(255), NOT NULL)
- `artist` (VARCHAR(255), NOT NULL)
- `album` (VARCHAR(255))
- `release_year` (INTEGER)
- `genre` (VARCHAR(255))
- `duration_seconds` (INTEGER)
- `rights_holder` (VARCHAR(255))
- `contact_email` (VARCHAR(255))
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### tracks
- `id` (UUID, Primary Key)
- `name` (VARCHAR(255), NOT NULL)
- `start_time_seconds` (DECIMAL(10,3), NOT NULL)
- `end_time_seconds` (DECIMAL(10,3), NOT NULL)
- `notes` (TEXT)
- `scene_id` (UUID, Foreign Key → scenes.id)
- `song_id` (UUID, Foreign Key → songs.id)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### license_statuses
- `id` (UUID, Primary Key)
- `status` (ENUM: 'pending', 'in_review', 'negotiating', 'approved', 'rejected', 'expired')
- `notes` (TEXT)
- `updated_by` (VARCHAR(255))
- `license_fee` (DECIMAL(10,2))
- `license_start_date` (DATE)
- `license_end_date` (DATE)
- `contract_details` (TEXT)
- `track_id` (UUID, Foreign Key → tracks.id)
- `created_at` (TIMESTAMP)

## Key Relationships

1. **One-to-Many**: Movie → Scenes
2. **One-to-Many**: Scene → Tracks
3. **Many-to-One**: Track → Song (songs can be reused across tracks)
4. **One-to-Many**: Track → LicenseStatuses (maintains history)

## Constraints

1. **Unique Scene Numbers**: Each movie can't have duplicate scene numbers
2. **Valid Time Ranges**: Track end_time must be greater than start_time
3. **License Date Logic**: For approved licenses, start_date must be before end_date
4. **Cascade Deletes**: Deleting a movie cascades to scenes and tracks

## Indexes

The following indexes are recommended for performance:

```sql
-- Performance indexes
CREATE INDEX idx_scenes_movie_id ON scenes(movie_id);
CREATE INDEX idx_tracks_scene_id ON tracks(scene_id);
CREATE INDEX idx_tracks_song_id ON tracks(song_id);
CREATE INDEX idx_license_statuses_track_id ON license_statuses(track_id);
CREATE INDEX idx_license_statuses_created_at ON license_statuses(created_at DESC);

-- Search indexes
CREATE INDEX idx_songs_title_artist ON songs(title, artist);
CREATE INDEX idx_movies_title ON movies(title);
```

## Views (Optional)

For easier querying, consider these views:

```sql
-- Current license status per track
CREATE VIEW current_license_status AS
SELECT DISTINCT ON (track_id) 
    track_id, 
    status, 
    notes, 
    license_fee,
    created_at
FROM license_statuses 
ORDER BY track_id, created_at DESC;

-- Movie licensing summary
CREATE VIEW movie_licensing_summary AS
SELECT 
    m.id as movie_id,
    m.title,
    COUNT(t.id) as total_tracks,
    COUNT(CASE WHEN cls.status = 'approved' THEN 1 END) as approved_tracks,
    COUNT(CASE WHEN cls.status = 'pending' THEN 1 END) as pending_tracks
FROM movies m
LEFT JOIN scenes s ON m.id = s.movie_id
LEFT JOIN tracks t ON s.id = t.scene_id
LEFT JOIN current_license_status cls ON t.id = cls.track_id
GROUP BY m.id, m.title;
```
