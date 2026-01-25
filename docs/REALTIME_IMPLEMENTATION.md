# Real-Time Implementation Recommendation

## 📋 Use Case Analysis

The primary real-time requirement for this API is:
- **Notify clients when licensing status changes** (one-way: server → client)
- **Update UI in real-time** when tracks are created, updated, or deleted
- **Show licensing status changes** as they happen

## 🎯 Technology Comparison

### Option 1: Server-Sent Events (SSE) ⭐ **RECOMMENDED**

**Pros:**
- ✅ **Perfect for one-way notifications** (server → client)
- ✅ **Simple implementation** - works with existing REST API
- ✅ **Built-in browser support** - no additional libraries needed
- ✅ **Automatic reconnection** - handles network issues gracefully
- ✅ **HTTP-based** - works through firewalls/proxies easily
- ✅ **Low overhead** - lighter than WebSockets
- ✅ **Native EventSource API** - easy client integration

**Cons:**
- ❌ One-way only (server → client)
- ❌ Limited to text data (JSON strings work fine)

**Best For:** Real-time notifications, status updates, live feeds

---

### Option 2: WebSockets

**Pros:**
- ✅ **Bidirectional communication** (client ↔ server)
- ✅ **Low latency** - persistent connection
- ✅ **Binary data support**
- ✅ **Full-duplex** - both sides can send messages

**Cons:**
- ❌ **More complex** - requires connection management, heartbeat, reconnection logic
- ❌ **Overkill** for one-way notifications
- ❌ **Higher resource usage** - maintains persistent connections
- ❌ **Firewall/proxy issues** - some networks block WebSocket connections
- ❌ **Requires additional libraries** (Socket.IO, ws, etc.)

**Best For:** Chat applications, collaborative editing, real-time gaming

---

### Option 3: GraphQL Subscriptions

**Pros:**
- ✅ **Type-safe** - leverages GraphQL schema
- ✅ **Flexible queries** - clients subscribe to exactly what they need
- ✅ **Built-in filtering** - subscribe to specific events/entities

**Cons:**
- ❌ **Requires GraphQL migration** - current API is REST
- ❌ **More complex setup** - requires GraphQL server + subscription transport
- ❌ **Overkill** for simple notifications
- ❌ **Additional dependencies** - GraphQL, subscription transport (WebSocket/SSE)

**Best For:** GraphQL APIs, complex real-time data requirements

---

## 🏆 Recommendation: Server-Sent Events (SSE)

**Why SSE is the best choice:**
1. **Matches the use case** - One-way notifications are exactly what SSE is designed for
2. **Minimal changes** - Works with existing REST API architecture
3. **Simple implementation** - Less code, easier to maintain
4. **Better performance** - Lower overhead than WebSockets for this use case
5. **Production-ready** - Built-in browser support, automatic reconnection

---

## 🚀 Implementation Guide

### Step 1: Install Dependencies

No additional dependencies needed! NestJS supports SSE out of the box.

### Step 2: Create SSE Service

```typescript
// src/realtime/realtime.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { Track, LicensingState } from '../entities/track.entity';

export interface RealtimeEvent {
  type: 'licensing_status_update' | 'track_created' | 'track_updated' | 'track_deleted';
  data: any;
  timestamp: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventSubject = new Subject<RealtimeEvent>();

  /**
   * Get observable stream of real-time events
   */
  getEventStream(): Observable<RealtimeEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Emit licensing status update event
   */
  emitLicensingStatusUpdate(
    track: Track,
    oldStatus: LicensingState,
    newStatus: LicensingState,
    notes?: string,
    updatedBy?: string,
  ): void {
    const event: RealtimeEvent = {
      type: 'licensing_status_update',
      data: {
        trackId: track.id,
        sceneId: track.sceneId,
        songId: track.songId,
        movieId: track.scene?.movieId,
        oldStatus,
        newStatus,
        notes,
        updatedBy,
        track: {
          id: track.id,
          sceneId: track.sceneId,
          songId: track.songId,
          startTime: track.startTime,
          endTime: track.endTime,
          currentLicensingStatus: track.currentLicensingStatus,
          scene: track.scene
            ? {
                id: track.scene.id,
                title: track.scene.title,
                movieId: track.scene.movieId,
              }
            : null,
          song: track.song
            ? {
                id: track.song.id,
                title: track.song.title,
                artist: track.song.artist,
              }
            : null,
        },
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `Emitting real-time event: ${event.type} for track ${track.id}`,
    );
    this.eventSubject.next(event);
  }

  /**
   * Emit track created event
   */
  emitTrackCreated(track: Track): void {
    const event: RealtimeEvent = {
      type: 'track_created',
      data: {
        trackId: track.id,
        sceneId: track.sceneId,
        songId: track.songId,
        movieId: track.scene?.movieId,
        track: {
          id: track.id,
          sceneId: track.sceneId,
          songId: track.songId,
          startTime: track.startTime,
          endTime: track.endTime,
          currentLicensingStatus: track.currentLicensingStatus,
        },
      },
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }

  /**
   * Emit track updated event
   */
  emitTrackUpdated(track: Track): void {
    const event: RealtimeEvent = {
      type: 'track_updated',
      data: {
        trackId: track.id,
        sceneId: track.sceneId,
        songId: track.songId,
        movieId: track.scene?.movieId,
        track: {
          id: track.id,
          sceneId: track.sceneId,
          songId: track.songId,
          startTime: track.startTime,
          endTime: track.endTime,
          currentLicensingStatus: track.currentLicensingStatus,
        },
      },
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }

  /**
   * Emit track deleted event
   */
  emitTrackDeleted(trackId: string, sceneId: string, movieId?: string): void {
    const event: RealtimeEvent = {
      type: 'track_deleted',
      data: {
        trackId,
        sceneId,
        movieId,
      },
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }
}
```

### Step 3: Create SSE Controller

```typescript
// src/realtime/realtime.controller.ts
import { Controller, Get, Res, Query, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { RealtimeService } from './realtime.service';
import { map } from 'rxjs/operators';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  private readonly logger = new Logger(RealtimeController.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @Get('events')
  @ApiOperation({
    summary: 'Subscribe to real-time events via Server-Sent Events',
    description:
      'Returns a stream of real-time events. Clients can filter by event type using query parameters.',
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    enum: [
      'licensing_status_update',
      'track_created',
      'track_updated',
      'track_deleted',
    ],
    description: 'Filter events by type (optional)',
  })
  @ApiQuery({
    name: 'trackId',
    required: false,
    description: 'Filter events for a specific track ID (optional)',
  })
  @ApiQuery({
    name: 'sceneId',
    required: false,
    description: 'Filter events for a specific scene ID (optional)',
  })
  @ApiQuery({
    name: 'movieId',
    required: false,
    description: 'Filter events for a specific movie ID (optional)',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of real-time events',
    headers: {
      'Content-Type': { description: 'text/event-stream' },
      'Cache-Control': { description: 'no-cache' },
      Connection: { description: 'keep-alive' },
    },
  })
  streamEvents(
    @Res() response: Response,
    @Query('eventType') eventType?: string,
    @Query('trackId') trackId?: string,
    @Query('sceneId') sceneId?: string,
    @Query('movieId') movieId?: string,
  ): void {
    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    response.write(`: Connected to real-time event stream\n\n`);

    // Subscribe to events with optional filtering
    const subscription = this.realtimeService
      .getEventStream()
      .pipe(
        map((event) => {
          // Apply filters
          if (eventType && event.type !== eventType) {
            return null;
          }
          if (trackId && event.data.trackId !== trackId) {
            return null;
          }
          if (sceneId && event.data.sceneId !== sceneId) {
            return null;
          }
          if (movieId && event.data.movieId !== movieId) {
            return null;
          }
          return event;
        }),
      )
      .subscribe({
        next: (event) => {
          if (event) {
            // Format as SSE message
            const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            response.write(sseMessage);
          }
        },
        error: (error) => {
          this.logger.error(`SSE stream error: ${error.message}`, error.stack);
          response.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream error' })}\n\n`);
        },
        complete: () => {
          this.logger.log('SSE stream completed');
          response.end();
        },
      });

    // Handle client disconnect
    response.on('close', () => {
      this.logger.log('Client disconnected from SSE stream');
      subscription.unsubscribe();
      response.end();
    });

    // Send periodic heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (!response.closed) {
        response.write(`: heartbeat\n\n`);
      } else {
        clearInterval(heartbeatInterval);
        subscription.unsubscribe();
      }
    }, 30000); // Every 30 seconds

    // Cleanup on disconnect
    response.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  }
}
```

### Step 4: Create Realtime Module

```typescript
// src/realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeController } from './realtime.controller';

@Module({
  providers: [RealtimeService],
  controllers: [RealtimeController],
  exports: [RealtimeService],
})
export class RealtimeModule {}
```

### Step 5: Integrate with Notification Service

```typescript
// src/notifications/strategies/realtime.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationStrategy,
  LicensingStatusUpdateData,
} from '../interfaces/notification-strategy.interface';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class RealtimeStrategy implements NotificationStrategy {
  private readonly logger = new Logger(RealtimeStrategy.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  async send(data: LicensingStatusUpdateData): Promise<void> {
    try {
      this.realtimeService.emitLicensingStatusUpdate(
        data.track,
        data.oldStatus,
        data.newStatus,
        data.notes,
        data.updatedBy,
      );
      this.logger.log(
        `Real-time event emitted for track ${data.track.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit real-time event: ${error.message}`,
        error.stack,
      );
      // Don't throw - allow other strategies to continue
    }
  }
}
```

### Step 6: Update Tracks Service

```typescript
// Add to src/tracks/tracks.service.ts

// Inject RealtimeService
constructor(
  // ... existing injections
  private readonly realtimeService: RealtimeService,
) {}

// In create() method, after successful creation:
async create(createTrackDto: CreateTrackDto): Promise<Track> {
  // ... existing code ...
  
  const savedTrack = await this.findOne(saved.id);
  
  // Emit real-time event
  this.realtimeService.emitTrackCreated(savedTrack);
  
  return savedTrack;
}

// In updateLicensingStatus() method, after successful update:
// The RealtimeStrategy will handle this via NotificationService

// In remove() method:
async remove(id: string): Promise<void> {
  const track = await this.findOne(id);
  const trackId = track.id;
  const sceneId = track.sceneId;
  const movieId = track.scene?.movieId;
  
  await this.trackRepository.remove(track);
  
  // Emit real-time event
  this.realtimeService.emitTrackDeleted(trackId, sceneId, movieId);
}
```

### Step 7: Update App Module

```typescript
// src/app.module.ts
import { RealtimeModule } from './realtime/realtime.module';
import { RealtimeStrategy } from './notifications/strategies/realtime.strategy';

@Module({
  imports: [
    // ... existing imports
    RealtimeModule,
  ],
  providers: [
    // ... existing providers
    {
      provide: 'NOTIFICATION_STRATEGIES',
      useFactory: (
        emailStrategy: EmailStrategy,
        pushStrategy: PushNotificationStrategy,
        realtimeStrategy: RealtimeStrategy,
      ) => [emailStrategy, pushStrategy, realtimeStrategy],
      inject: [EmailStrategy, PushNotificationStrategy, RealtimeStrategy],
    },
  ],
})
export class AppModule {}
```

---

## 💻 Client Implementation Examples

### JavaScript/TypeScript (Browser)

```typescript
// Connect to SSE stream
const eventSource = new EventSource('http://localhost:3000/realtime/events?eventType=licensing_status_update');

// Listen for events
eventSource.addEventListener('licensing_status_update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Licensing status updated:', data);
  
  // Update UI
  updateTrackStatus(data.data.trackId, data.data.newStatus);
});

// Listen for errors
eventSource.addEventListener('error', (event) => {
  console.error('SSE connection error:', event);
});

// Close connection when done
// eventSource.close();
```

### React Hook Example

```typescript
// hooks/useRealtimeEvents.ts
import { useEffect, useState } from 'react';

interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
}

export function useRealtimeEvents(
  filters?: {
    eventType?: string;
    trackId?: string;
    sceneId?: string;
    movieId?: string;
  },
) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters?.eventType) params.append('eventType', filters.eventType);
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

    // Listen for all event types
    eventSource.addEventListener('licensing_status_update', (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);
    });

    eventSource.addEventListener('track_created', (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);
    });

    eventSource.addEventListener('track_updated', (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev, data]);
    });

    eventSource.addEventListener('track_deleted', (event) => {
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

### Usage in React Component

```typescript
// components/TrackList.tsx
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

function TrackList({ movieId }: { movieId: string }) {
  const { events, isConnected } = useRealtimeEvents({ movieId });

  useEffect(() => {
    // Handle licensing status updates
    const statusUpdates = events.filter(
      (e) => e.type === 'licensing_status_update',
    );
    statusUpdates.forEach((event) => {
      // Update track status in UI
      updateTrackInState(event.data.trackId, {
        status: event.data.newStatus,
      });
    });
  }, [events]);

  return (
    <div>
      {isConnected && <span className="status-indicator">● Live</span>}
      {/* Track list UI */}
    </div>
  );
}
```

---

## 🔧 Testing

### cURL Example

```bash
# Connect to SSE stream
curl -N http://localhost:3000/realtime/events

# Filter by event type
curl -N "http://localhost:3000/realtime/events?eventType=licensing_status_update"

# Filter by movie ID
curl -N "http://localhost:3000/realtime/events?movieId=550e8400-e29b-41d4-a716-446655440000"
```

### Unit Test Example

```typescript
// tests/realtime/realtime.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { LicensingState } from '../../src/entities/track.entity';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealtimeService],
    }).compile();

    service = module.get<RealtimeService>(RealtimeService);
  });

  it('should emit licensing status update events', (done) => {
    const mockTrack = {
      id: 'track-1',
      sceneId: 'scene-1',
      songId: 'song-1',
      currentLicensingStatus: LicensingState.APPROVED,
      scene: { id: 'scene-1', movieId: 'movie-1' },
      song: { id: 'song-1', title: 'Test Song' },
    };

    service.getEventStream().subscribe((event) => {
      expect(event.type).toBe('licensing_status_update');
      expect(event.data.trackId).toBe('track-1');
      expect(event.data.oldStatus).toBe(LicensingState.PENDING);
      expect(event.data.newStatus).toBe(LicensingState.APPROVED);
      done();
    });

    service.emitLicensingStatusUpdate(
      mockTrack as any,
      LicensingState.PENDING,
      LicensingState.APPROVED,
    );
  });
});
```

---

## 📊 Performance Considerations

1. **Connection Limits**: Each SSE connection consumes server resources. Consider:
   - Connection pooling
   - Rate limiting per IP
   - Maximum concurrent connections

2. **Scaling**: For horizontal scaling, consider:
   - Redis Pub/Sub for multi-instance deployments
   - Message queue (RabbitMQ, Kafka) for high-volume scenarios

3. **Filtering**: Client-side filtering reduces bandwidth but server-side filtering is more efficient.

---

## 🚀 Alternative: WebSocket Implementation (If Needed)

If bidirectional communication is required later, here's a quick WebSocket implementation:

```typescript
// Install: npm install @nestjs/websockets socket.io

// src/realtime/realtime.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { movieId?: string; sceneId?: string }) {
    if (payload.movieId) {
      client.join(`movie:${payload.movieId}`);
    }
    if (payload.sceneId) {
      client.join(`scene:${payload.sceneId}`);
    }
  }

  emitLicensingStatusUpdate(room: string, data: any) {
    this.server.to(room).emit('licensing_status_update', data);
  }
}
```

---

## ✅ Summary

**Recommended Approach: Server-Sent Events (SSE)**

- ✅ Simple to implement
- ✅ Perfect for one-way notifications
- ✅ Works with existing REST API
- ✅ Built-in browser support
- ✅ Automatic reconnection
- ✅ Low overhead

**Implementation Steps:**
1. Create `RealtimeService` for event management
2. Create `RealtimeController` with SSE endpoint
3. Add `RealtimeStrategy` to notification strategies
4. Integrate with `TracksService` to emit events
5. Update `AppModule` to register new modules

**Next Steps:**
- Implement the SSE solution as outlined above
- Add unit tests for realtime service
- Add E2E tests for SSE endpoint
- Update frontend to consume SSE events
- Consider Redis Pub/Sub for multi-instance scaling
