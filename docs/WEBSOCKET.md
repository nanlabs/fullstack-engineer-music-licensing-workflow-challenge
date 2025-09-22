# 🔌 WebSocket Implementation - Music Licensing System

## Overview

The music licensing system includes WebSocket for real-time updates using Socket.IO.

## ✅ Configuration Completed

### 1. WebSocket Gateway

- **File**: `src/common/gateways/license-update.gateway.ts`
- **Port**: Same as HTTP server (3001 by default)
- **CORS**: Configured to allow connections from frontend

### 2. Available Events

#### `licenseStatusUpdate`

Emitted when a license status changes:

```javascript
{
  trackId: number,
  sceneId: number,
  movieId: number,
  newStatus: LicenseStatus,
  updatedBy?: string
}
```

#### `trackCreated`

Emitted when a new track is created:

```javascript
{
  track: Track,
  sceneId: string,
  movieId: string
}
```

### 3. Room Functionalities

- **Join a movie room**: `joinMovieRoom(client, movieId)`
- **Leave a room**: `leaveMovieRoom(client, movieId)`
- **Emit to specific room**: `emitToMovieRoom(movieId, event, data)`

## 🧪 How to Test

### Option 1: HTML Client (Browser)

```bash
# Open in browser
open test-websocket.html
```

### Option 2: Node.js Client

```bash
# Terminal 1: Start server
npm run start:dev

# Terminal 2: Connect WebSocket client
node test-websocket-client.js

# Terminal 3: Run API tests
node test-api-websocket.js
```

### Option 3: Basic JavaScript client

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('licenseStatusUpdate', (data) => {
  console.log('Status updated:', data);
});

socket.on('trackCreated', (data) => {
  console.log('Track created:', data);
});
```

## 🛠️ Service Integration

### LicensesService

The licenses service already emits events when:

- A license status is updated (`updateTrackLicenseStatus`)

### TracksService

The tracks service emits events when:

- A new track is created (`create`)

### Usage in other services

```typescript
// Inject the gateway
constructor(
  @Inject(LicenseUpdateGateway)
  private readonly licenseUpdateGateway: LicenseUpdateGateway,
) {}

// Emit events
this.licenseUpdateGateway.emitLicenseStatusUpdate({
  trackId: 1,
  sceneId: 1,
  movieId: 1,
  newStatus: licenseStatus,
});
```

## 🌐 Frontend Integration

### React/Vue/Angular

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Listen to events
socket.on('licenseStatusUpdate', (data) => {
  // Update UI
  updateLicenseStatus(data);
});

socket.on('trackCreated', (data) => {
  // Update track list
  addTrackToList(data.track);
});
```

### Connection Management

```javascript
// Connect
const socket = io('http://localhost:3001', {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

## 🔧 Configuration

### Server

- **Port**: 3001 (configurable via `PORT` env var)
- **CORS**: Configured for development (`*`)
- **Transport**: WebSocket + polling fallback

### Client

- **URL**: `http://localhost:3001`
- **Recommended options**:
  ```javascript
  {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  }
  ```

## 📝 Development Notes

1. **Logging**: All events are logged on the server
2. **Error Handling**: WebSocket errors don't interrupt main flow
3. **Performance**: Events are emitted asynchronously without blocking
4. **Scalability**: Ready to use Redis adapter if needed

## 🚀 Next Steps

1. **Authentication**: Add authentication to WebSocket connections
2. **Room Management**: Implement UI for room management
3. **Reconnection**: Improve automatic reconnection logic
4. **Rate Limiting**: Implement event limits per client

## 🐛 Debugging

### Verify connection

```bash
# Server logs
npm run start:dev

# Look for WebSocket logs
# ✅ "WebSocket Gateway initialized"
# ✅ "Client connected: [socket-id]"
```

### Common issues

1. **CORS Error**: Check configuration in `main.ts`
2. **Port occupied**: Change `PORT` in `.env`
3. **No events**: Verify that services are injecting the gateway
