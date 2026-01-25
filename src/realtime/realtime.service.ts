import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { Track, LicensingState } from '../entities/track.entity';
import {
  RealtimeEvent,
  LicensingStatusUpdateData,
  TrackCreatedData,
  TrackUpdatedData,
  TrackDeletedData,
} from './interfaces/realtime-event.interface';

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventSubject = new Subject<RealtimeEvent>();

  onModuleDestroy() {
    this.eventSubject.complete();
    this.logger.log('RealtimeService event stream closed');
  }

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
    const data: LicensingStatusUpdateData = {
      trackId: track.id,
      sceneId: track.sceneId,
      songId: track.songId,
      movieId: track.scene?.movieId ?? null,
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
    };

    const event: RealtimeEvent = {
      type: 'licensing_status_update',
      data,
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
    const data: TrackCreatedData = {
      trackId: track.id,
      sceneId: track.sceneId,
      songId: track.songId,
      movieId: track.scene?.movieId ?? null,
      track: {
        id: track.id,
        sceneId: track.sceneId,
        songId: track.songId,
        startTime: track.startTime,
        endTime: track.endTime,
        currentLicensingStatus: track.currentLicensingStatus,
      },
    };

    const event: RealtimeEvent = {
      type: 'track_created',
      data,
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }

  /**
   * Emit track updated event
   */
  emitTrackUpdated(track: Track): void {
    const data: TrackUpdatedData = {
      trackId: track.id,
      sceneId: track.sceneId,
      songId: track.songId,
      movieId: track.scene?.movieId ?? null,
      track: {
        id: track.id,
        sceneId: track.sceneId,
        songId: track.songId,
        startTime: track.startTime,
        endTime: track.endTime,
        currentLicensingStatus: track.currentLicensingStatus,
      },
    };

    const event: RealtimeEvent = {
      type: 'track_updated',
      data,
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }

  /**
   * Emit track deleted event
   */
  emitTrackDeleted(trackId: string, sceneId: string, movieId?: string): void {
    const data: TrackDeletedData = {
      trackId,
      sceneId,
      movieId,
    };

    const event: RealtimeEvent = {
      type: 'track_deleted',
      data,
      timestamp: new Date().toISOString(),
    };

    this.eventSubject.next(event);
  }
}
