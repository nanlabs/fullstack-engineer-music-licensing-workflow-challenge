# Music Licensing API Documentation

## Overview

The Music Licensing API provides endpoints for managing movies, scenes, tracks, songs, and their licensing workflow states. This API is built with NestJS and includes real-time updates via WebSockets.

## Base URL

```
http://localhost:3001/api
```

## Interactive Documentation

Visit the Swagger UI at: `http://localhost:3001/api/docs`

## API Endpoints

### Movies

- `GET /api/movies` - Get all movies
- `GET /api/movies/:id` - Get movie by ID
- `GET /api/movies/:id/stats` - Get movie with licensing statistics
- `POST /api/movies` - Create a new movie
- `PATCH /api/movies/:id` - Update a movie
- `DELETE /api/movies/:id` - Delete a movie

### Scenes

- `GET /api/scenes` - Get all scenes (filterable by movieId)
- `GET /api/scenes/:id` - Get scene by ID
- `POST /api/scenes` - Create a new scene
- `PATCH /api/scenes/:id` - Update a scene
- `DELETE /api/scenes/:id` - Delete a scene

### Songs

- `GET /api/songs` - Get all songs (searchable by query)
- `GET /api/songs/:id` - Get song by ID
- `POST /api/songs` - Create a new song
- `PATCH /api/songs/:id` - Update a song
- `DELETE /api/songs/:id` - Delete a song

### Tracks

- `GET /api/tracks` - Get all tracks (filterable by sceneId or movieId)
- `GET /api/tracks/:id` - Get track by ID
- `POST /api/tracks` - Create a new track and associate with song
- `DELETE /api/tracks/:id` - Delete a track

### Licenses

- `POST /api/licenses/tracks/:trackId/status` - Update licensing status of a track
- `GET /api/licenses/tracks/:trackId/history` - Get license status history
- `GET /api/licenses/tracks/:trackId/current` - Get current license status
- `GET /api/licenses/statistics` - Get overall licensing statistics

## License Status Workflow

The licensing workflow follows these states and allowed transitions:

1. **PENDING** → `IN_REVIEW`, `REJECTED`
2. **IN_REVIEW** → `NEGOTIATING`, `APPROVED`, `REJECTED`, `PENDING`
3. **NEGOTIATING** → `APPROVED`, `REJECTED`, `IN_REVIEW`
4. **APPROVED** → `EXPIRED`, `NEGOTIATING`
5. **REJECTED** → `PENDING`, `IN_REVIEW`
6. **EXPIRED** → `PENDING`, `NEGOTIATING`

## Real-time Updates

Connect to WebSocket endpoint for real-time updates:

```
ws://localhost:3001/license-updates
```

### Events

- `licenseStatusUpdate` - Emitted when a track's license status changes
- `trackCreated` - Emitted when a new track is created
- `movieStatisticsUpdate` - Emitted when movie statistics change

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
  "statusCode": 400,
  "message": "Invalid status transition from approved to pending",
  "error": "Bad Request"
}
```
