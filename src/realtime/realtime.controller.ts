import { Controller, Get, Res, Query, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { map } from 'rxjs/operators';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  private readonly logger = new Logger(RealtimeController.name);
  private static activeConnections = 0;
  private static readonly connectionLock = new Map<string, boolean>();

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

  private incrementConnections(): boolean {
    const maxConnections = this.getMaxConnections();
    // Simple atomic-like increment check
    if (RealtimeController.activeConnections >= maxConnections) {
      return false;
    }
    RealtimeController.activeConnections++;
    return true;
  }

  private decrementConnections(): void {
    RealtimeController.activeConnections = Math.max(
      0,
      RealtimeController.activeConnections - 1,
    );
  }

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
    // Check and increment connection limit atomically
    if (!this.incrementConnections()) {
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
              this.decrementConnections();
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
          this.decrementConnections();
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
          this.decrementConnections();
          if (!response.closed) {
            response.end();
          }
        },
      });

    // Send periodic heartbeat to keep connection alive
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
          this.decrementConnections();
        }
      } catch (error) {
        // Client disconnected, cleanup
        clearInterval(heartbeatTimer);
        subscription.unsubscribe();
        this.decrementConnections();
      }
    }, heartbeatInterval);

    // Handle client disconnect and cleanup
    const cleanup = () => {
      clearInterval(heartbeatTimer);
      subscription.unsubscribe();
      this.decrementConnections();
      const maxConnections = this.getMaxConnections();
      this.logger.log(
        `Client disconnected from SSE stream: ${RealtimeController.activeConnections}/${maxConnections}`,
      );
    };

    response.on('close', cleanup);
    response.on('error', cleanup);
  }
}
