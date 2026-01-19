import {
  Controller,
  Param,
  Sse,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import type { Observable } from 'rxjs';
import { SseNotificationService } from './sse-notification.service';
import { NotificationKeys } from 'libs/shared';
import type {
  LicensingStatusUpdate,
  TrackCreatedEvent,
  SSMessageEvent,
} from 'libs/shared';

@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(private readonly sseNotificationService: SseNotificationService) {}

  /**
   * SSE endpoint for real-time notifications.
   *
   * Available channels:
   * - `licensing-status`: Updates when track licensing status changes
   * - `track-created`: Notifications when new tracks are created
   *
   * @example
   * ```javascript
   * const es = new EventSource('/sse/notifications/licensing-status');
   * es.onmessage = (e) => console.log(JSON.parse(e.data));
   * ```
   */
  @Sse('notifications/:key')
  subscribeToNotifications(
    @Param('key') key: string,
  ): Observable<SSMessageEvent<unknown>> {
    const validKeys = Object.values(NotificationKeys);

    if (!validKeys.includes(key as NotificationKeys)) {
      this.logger.warn(`Invalid notification key requested: ${key}`);
      throw new BadRequestException(
        `Invalid notification key: "${key}". Valid keys: ${validKeys.join(', ')}`,
      );
    }

    const stream = this.sseNotificationService.getStreamByKey(key);

    if (!stream) {
      throw new BadRequestException(`Stream not available for key: ${key}`);
    }

    this.logger.log(`Client subscribed to SSE channel: ${key}`);
    return stream;
  }

  /**
   * Event handler for licensing status updates from track microservice.
   * Receives events via RabbitMQ and pushes to SSE subscribers.
   */
  @EventPattern('licensing.status.updated')
  handleLicensingStatusUpdate(payload: LicensingStatusUpdate): void {
    this.logger.log(
      `Licensing status updated: Track ${payload.trackId} -> ${payload.newStatus}`,
    );
    this.sseNotificationService.emit(NotificationKeys.LICENSING_STATUS, payload);
  }

  /**
   * Event handler for track creation events from track microservice.
   * Receives events via RabbitMQ and pushes to SSE subscribers.
   */
  @EventPattern('track.created')
  handleTrackCreated(payload: TrackCreatedEvent): void {
    this.logger.log(`Track created: ${payload.trackId}`);
    this.sseNotificationService.emit(NotificationKeys.TRACK_CREATED, payload);
  }
}
