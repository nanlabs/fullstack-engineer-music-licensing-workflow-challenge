import { Controller, Get, Res, Query, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { RealtimeQueryDto, RealtimeEventType } from './dto/realtime-query.dto';
import { map } from 'rxjs/operators';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  private readonly logger = new Logger(RealtimeController.name);
  private static activeConnections = 0;
  private static readonly connectionMutex = { locked: false, queue: [] as Array<() => void> };

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly configService: ConfigService,
  ) {}

  private getMaxConnections(): number {
    return parseInt(
      this.configService.get<string>('app.sseMaxConnections') || '1000',
      10,
    );
  }

  /**
   * Acquire mutex lock for connection counter operations
   */
  private async acquireLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!RealtimeController.connectionMutex.locked) {
        RealtimeController.connectionMutex.locked = true;
        resolve();
      } else {
        RealtimeController.connectionMutex.queue.push(resolve);
      }
    });
  }

  /**
   * Release mutex lock
   */
  private releaseLock(): void {
    RealtimeController.connectionMutex.locked = false;
    const next = RealtimeController.connectionMutex.queue.shift();
    if (next) {
      RealtimeController.connectionMutex.locked = true;
      next();
    }
  }

  /**
   * Atomically increment connection counter with mutex
   */
  private async incrementConnections(): Promise<boolean> {
    await this.acquireLock();
    try {
      const maxConnections = this.getMaxConnections();
      if (RealtimeController.activeConnections >= maxConnections) {
        return false;
      }
      RealtimeController.activeConnections++;
      return true;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Atomically decrement connection counter with mutex
   */
  private async decrementConnections(): Promise<void> {
    await this.acquireLock();
    try {
      RealtimeController.activeConnections = Math.max(
        0,
        RealtimeController.activeConnections - 1,
      );
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Subscribe to real-time events via Server-Sent Events (SSE)
   * 
   * Establishes a persistent SSE connection for receiving real-time updates about
   * licensing status changes, track creation, updates, and deletions.
   * 
   * @param response - Express response object for SSE streaming
   * @param query - Query parameters for filtering events (eventType, trackId, sceneId, movieId)
   * @returns Promise that resolves when the stream is established
   * 
   * @throws {503} Too many concurrent connections when connection limit is reached
   * 
   * @example
   * // Subscribe to all events
   * GET /realtime/events
   * 
   * // Filter by event type
   * GET /realtime/events?eventType=licensing_status_update
   * 
   * // Filter by track ID
   * GET /realtime/events?trackId=550e8400-e29b-41d4-a716-446655440000
   */
  @Get('events')
  @ApiOperation({
    summary: 'Subscribe to real-time events via Server-Sent Events',
    description:
      'Returns a stream of real-time events. Clients can filter by event type using query parameters.',
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
  async streamEvents(
    @Res() response: Response,
    @Query() query: RealtimeQueryDto,
  ): Promise<void> {
    const { eventType, trackId, sceneId, movieId } = query;
    // Check and increment connection limit atomically
    const canConnect = await this.incrementConnections();
    if (!canConnect) {
      const maxConnections = this.getMaxConnections();
      this.logger.warn(
        `SSE connection limit reached: ${RealtimeController.activeConnections}/${maxConnections}`,
      );
      response.status(503).json({
        success: false,
        statusCode: 503,
        message: 'Too many concurrent connections. Please try again later.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const maxConnections = this.getMaxConnections();
    this.logger.log(
      `SSE connection established: ${RealtimeController.activeConnections}/${maxConnections}`,
    );

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    response.write(`: Connected to real-time event stream\n\n`);

    // Send periodic heartbeat to keep connection alive
    // Declare heartbeatTimer before subscription so it's available in error handlers
    const heartbeatInterval = parseInt(
      this.configService.get<string>('app.sseHeartbeatInterval') || '30000',
      10,
    );
    const heartbeatTimer = setInterval(() => {
      try {
        if (!response.closed) {
          response.write(`: heartbeat\n\n`);
        } else {
          clearInterval(heartbeatTimer);
          subscription.unsubscribe();
          this.decrementConnections().catch((err) => {
            this.logger.error(`Error decrementing connections: ${err.message}`);
          });
        }
      } catch (error) {
        // Client disconnected, cleanup
        clearInterval(heartbeatTimer);
        subscription.unsubscribe();
        this.decrementConnections().catch((err) => {
          this.logger.error(`Error decrementing connections: ${err.message}`);
        });
      }
    }, heartbeatInterval);

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
        next: async (event) => {
          if (event) {
            try {
              // Format as SSE message
              const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
              if (!response.closed) {
                response.write(sseMessage);
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`Error writing SSE message: ${errorMessage}`);
              clearInterval(heartbeatTimer);
              subscription.unsubscribe();
              await this.decrementConnections();
              if (!response.closed) {
                response.end();
              }
            }
          }
        },
        error: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`SSE stream error: ${errorMessage}`, errorStack);
          clearInterval(heartbeatTimer);
          subscription.unsubscribe();
          this.decrementConnections().catch((err) => {
            this.logger.error(`Error decrementing connections: ${err.message}`);
          });
          try {
            if (!response.closed) {
              response.write(
                `event: error\ndata: ${JSON.stringify({ message: 'Stream error' })}\n\n`,
              );
              response.end();
            }
          } catch (writeError) {
            // Ignore write errors during error handling
          }
        },
        complete: () => {
          this.logger.log('SSE stream completed');
          clearInterval(heartbeatTimer);
          subscription.unsubscribe();
          this.decrementConnections().catch((err) => {
            this.logger.error(`Error decrementing connections: ${err.message}`);
          });
          if (!response.closed) {
            response.end();
          }
        },
      });

    // Handle client disconnect and cleanup
    const cleanup = () => {
      clearInterval(heartbeatTimer);
      subscription.unsubscribe();
      this.decrementConnections().catch((err) => {
        this.logger.error(`Error decrementing connections: ${err.message}`);
      });
      const maxConnections = this.getMaxConnections();
      this.logger.log(
        `Client disconnected from SSE stream: ${RealtimeController.activeConnections}/${maxConnections}`,
      );
    };

    response.on('close', cleanup);
    response.on('error', cleanup);
  }
}
