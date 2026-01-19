export enum NotificationKeys {
  LICENSING_STATUS = 'licensing-status',
  TRACK_CREATED = 'track-created',
}

export interface SSMessageEvent<T = unknown> {
  data: T;
  id?: string;
  type?: string;
  retry?: number;
}

export interface LicensingStatusUpdate {
  trackId: number;
  previousStatus: string;
  newStatus: string;
  updatedAt: Date;
}

export interface TrackCreatedEvent {
  trackId: number;
  songId: number;
  movieSceneId: number;
  licensingStatus: string;
  createdAt: Date;
}

/**
 * Type-safe mapping between notification keys and their payload types.
 * This ensures emit() and getStream() are correctly typed.
 */
export interface NotificationPayloadMap {
  [NotificationKeys.LICENSING_STATUS]: LicensingStatusUpdate;
  [NotificationKeys.TRACK_CREATED]: TrackCreatedEvent;
}
