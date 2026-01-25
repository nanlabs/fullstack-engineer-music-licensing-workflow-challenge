import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { Track, LicensingState } from '../entities/track.entity';

export interface RealtimeEvent {
  type:
    | 'licensing_status_update'
    | 'track_created'
    | 'track_updated'
    | 'track_deleted';
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
