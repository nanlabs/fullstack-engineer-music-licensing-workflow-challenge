# SSE Real-Time Updates - Usage Guide

## Overview

Server-Sent Events (SSE) have been implemented to provide real-time updates when licensing status changes occur. The SSE endpoint automatically emits events whenever a track's licensing status is updated.

## Endpoint

```
GET /realtime/events
```

## Query Parameters

- `eventType` (optional): Filter by event type (`licensing_status_update`, `track_created`, `track_updated`, `track_deleted`)
- `trackId` (optional): Filter events for a specific track ID
- `sceneId` (optional): Filter events for a specific scene ID
- `movieId` (optional): Filter events for a specific movie ID

## Testing with cURL

### Basic Connection

```bash
curl -N http://localhost:3000/realtime/events
```

### Filter by Event Type (Licensing Status Updates Only)

```bash
curl -N "http://localhost:3000/realtime/events?eventType=licensing_status_update"
```

### Filter by Movie ID

```bash
curl -N "http://localhost:3000/realtime/events?movieId=550e8400-e29b-41d4-a716-446655440000"
```

### Filter by Track ID

```bash
curl -N "http://localhost:3000/realtime/events?trackId=550e8400-e29b-41d4-a716-446655440001"
```

### Multiple Filters

```bash
curl -N "http://localhost:3000/realtime/events?eventType=licensing_status_update&movieId=550e8400-e29b-41d4-a716-446655440000"
```

## JavaScript/TypeScript Client Example

```javascript
// Connect to SSE stream
const eventSource = new EventSource('http://localhost:3000/realtime/events?eventType=licensing_status_update');

// Listen for licensing status update events
eventSource.addEventListener('licensing_status_update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Licensing status updated:', data);
  
  // Update UI
  updateTrackStatus(data.data.trackId, data.data.newStatus);
});

// Listen for errors
eventSource.addEventListener('error', (event) => {
  console.error('SSE connection error:', event);
  // EventSource automatically reconnects
});

// Close connection when done
// eventSource.close();
```

## React Hook Example

```typescript
import { useEffect, useState } from 'react';

interface LicensingStatusEvent {
  type: 'licensing_status_update';
  data: {
    trackId: string;
    sceneId: string;
    songId: string;
    movieId?: string;
    oldStatus: string;
    newStatus: string;
    notes?: string;
    updatedBy?: string;
    track: {
      id: string;
      sceneId: string;
      songId: string;
      currentLicensingStatus: string;
      // ... other track fields
    };
  };
  timestamp: string;
}

export function useLicensingStatusUpdates(filters?: {
  trackId?: string;
  sceneId?: string;
  movieId?: string;
}) {
  const [events, setEvents] = useState<LicensingStatusEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.append('eventType', 'licensing_status_update');
    if (filters?.trackId) params.append('trackId', filters.trackId);
    if (filters?.sceneId) params.append('sceneId', filters.sceneId);
    if (filters?.movieId) params.append('movieId', filters.movieId);

    const eventSource = new EventSource(
      `/realtime/events?${params.toString()}`,
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.addEventListener('licensing_status_update', (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);
    });

    return () => {
      eventSource.close();
    };
  }, [filters]);

  return { events, isConnected };
}
```

## Event Format

When a licensing status is updated, the following event is emitted:

```json
{
  "type": "licensing_status_update",
  "data": {
    "trackId": "550e8400-e29b-41d4-a716-446655440001",
    "sceneId": "550e8400-e29b-41d4-a716-446655440002",
    "songId": "550e8400-e29b-41d4-a716-446655440003",
    "movieId": "550e8400-e29b-41d4-a716-446655440000",
    "oldStatus": "pending",
    "newStatus": "approved",
    "notes": "License approved by admin",
    "updatedBy": "admin",
    "track": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "sceneId": "550e8400-e29b-41d4-a716-446655440002",
      "songId": "550e8400-e29b-41d4-a716-446655440003",
      "startTime": 0,
      "endTime": 180,
      "currentLicensingStatus": "approved",
      "scene": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "title": "Opening Scene",
        "movieId": "550e8400-e29b-41d4-a716-446655440000"
      },
      "song": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "title": "Test Song",
        "artist": "Test Artist"
      }
    }
  },
  "timestamp": "2024-01-24T21:30:00.000Z"
}
```

## Testing the Implementation

1. **Start the API:**
   ```bash
   npm run start:dev
   ```

2. **In one terminal, connect to SSE stream:**
   ```bash
   curl -N "http://localhost:3000/realtime/events?eventType=licensing_status_update"
   ```

3. **In another terminal, update a track's licensing status:**
   ```bash
   curl -X PATCH http://localhost:3000/tracks/<track-id>/licensing-status \
     -H "Content-Type: application/json" \
     -d '{
       "status": "approved",
       "notes": "License approved",
       "updatedBy": "admin"
     }'
   ```

4. **You should see the event appear in the SSE stream immediately!**

## Features

- ✅ **Automatic reconnection** - EventSource handles reconnection automatically
- ✅ **Heartbeat** - Connection kept alive with periodic heartbeat messages
- ✅ **Filtering** - Filter events by type, track, scene, or movie
- ✅ **Error handling** - Graceful error handling and logging
- ✅ **Non-blocking** - Real-time events don't block the main API response

## Integration Points

The SSE implementation is automatically triggered when:
- A track's licensing status is updated via `PATCH /tracks/:id/licensing-status`

The event is emitted **after** the database transaction is committed, ensuring data consistency.
