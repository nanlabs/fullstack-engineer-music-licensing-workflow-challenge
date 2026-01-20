import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';
import type { Observable } from 'rxjs';
import { NotificationKeys } from 'libs/shared';
import type { SSMessageEvent, NotificationPayloadMap } from 'libs/shared';

/**
 * Mapped type: each key maps to its specific ReplaySubject type.
 * This ensures streams[LICENSING_STATUS] returns ReplaySubject<SSMessageEvent<LicensingStatusUpdate>>
 */
type NotificationStreams = {
  [K in NotificationKeys]: ReplaySubject<SSMessageEvent<NotificationPayloadMap[K]>>;
};

/**
 * Helper type to extract keys from NotificationPayloadMap
 */
type NotificationKey = keyof NotificationPayloadMap;

@Injectable()
export class SseNotificationService implements OnModuleDestroy {
  /**
   * Type-safe streams object using Mapped Types.
   * Each key is strongly typed to its corresponding payload.
   */
  private readonly streams: NotificationStreams;

  constructor() {
    // Initialize streams with proper typing using reduce
    this.streams = Object.values(NotificationKeys).reduce(
      (acc, key) => ({
        ...acc,
        [key]: new ReplaySubject<SSMessageEvent<NotificationPayloadMap[typeof key]>>(1),
      }),
      {} as NotificationStreams,
    );
  }

  /**
   * Type-safe emit using keyof - TypeScript enforces correct payload for each key.
   *
   * @example
   * // ✅ Correct - LicensingStatusUpdate for LICENSING_STATUS
   * emit(NotificationKeys.LICENSING_STATUS, { trackId: 1, previousStatus: '...', ... });
   *
   * // ❌ TypeScript error - wrong payload type
   * emit(NotificationKeys.LICENSING_STATUS, { songId: 1 });
   */
  emit<K extends NotificationKey>(key: K, payload: NotificationPayloadMap[K]): void {
    this.streams[key].next({
      data: payload,
      id: `${key}-${Date.now()}`,
      type: key,
    } as SSMessageEvent<NotificationPayloadMap[K]>);
  }

  /**
   * Type-safe stream getter using keyof - returns correctly typed Observable.
   *
   * @example
   * const stream = getStream(NotificationKeys.LICENSING_STATUS);
   * // stream type: Observable<SSMessageEvent<LicensingStatusUpdate>>
   */
  getStream<K extends NotificationKey>(
    key: K,
  ): Observable<SSMessageEvent<NotificationPayloadMap[K]>> {
    return this.streams[key].asObservable();
  }

  /**
   * Get stream by string key (for dynamic @Sse endpoint).
   * Type guard validates key is a valid NotificationKey.
   */
  getStreamByKey(key: string): Observable<SSMessageEvent<unknown>> | undefined {
    if (!this.isValidKey(key)) {
      return undefined;
    }
    return this.getStream(key);
  }

  /**
   * Type guard to validate string is a valid NotificationKey
   */
  private isValidKey(key: string): key is NotificationKey {
    return Object.values(NotificationKeys).includes(key as NotificationKeys);
  }

  /**
   * Clean up subjects on module destroy to prevent memory leaks.
   */
  onModuleDestroy(): void {
    Object.values(this.streams).forEach((subject) => subject.complete());
  }
}
