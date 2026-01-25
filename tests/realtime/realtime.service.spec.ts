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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitLicensingStatusUpdate', () => {
    it('should emit licensing status update events', (done) => {
      const mockTrack = {
        id: 'track-1',
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
        currentLicensingStatus: LicensingState.APPROVED,
        scene: {
          id: 'scene-1',
          title: 'Test Scene',
          movieId: 'movie-1',
        },
        song: {
          id: 'song-1',
          title: 'Test Song',
          artist: 'Test Artist',
        },
      };

      service.getEventStream().subscribe((event) => {
        expect(event.type).toBe('licensing_status_update');
        expect(event.data.trackId).toBe('track-1');
        expect(event.data.sceneId).toBe('scene-1');
        expect(event.data.songId).toBe('song-1');
        expect(event.data.movieId).toBe('movie-1');
        expect(event.data.oldStatus).toBe(LicensingState.PENDING);
        expect(event.data.newStatus).toBe(LicensingState.APPROVED);
        expect(event.data.notes).toBe('Test notes');
        expect(event.data.updatedBy).toBe('admin');
        expect(event.data.track).toBeDefined();
        expect(event.timestamp).toBeDefined();
        done();
      });

      service.emitLicensingStatusUpdate(
        mockTrack as any,
        LicensingState.PENDING,
        LicensingState.APPROVED,
        'Test notes',
        'admin',
      );
    });

    it('should handle optional fields', (done) => {
      const mockTrack = {
        id: 'track-2',
        sceneId: 'scene-2',
        songId: 'song-2',
        startTime: 0,
        endTime: 180,
        currentLicensingStatus: LicensingState.NEGOTIATING,
        scene: null,
        song: null,
      };

      service.getEventStream().subscribe((event) => {
        expect(event.type).toBe('licensing_status_update');
        expect(event.data.notes).toBeUndefined();
        expect(event.data.updatedBy).toBeUndefined();
        expect(event.data.track.scene).toBeNull();
        expect(event.data.track.song).toBeNull();
        done();
      });

      service.emitLicensingStatusUpdate(
        mockTrack as any,
        LicensingState.PENDING,
        LicensingState.NEGOTIATING,
      );
    });
  });

  describe('emitTrackCreated', () => {
    it('should emit track created events', (done) => {
      const mockTrack = {
        id: 'track-3',
        sceneId: 'scene-3',
        songId: 'song-3',
        startTime: 0,
        endTime: 180,
        currentLicensingStatus: LicensingState.PENDING,
        scene: {
          id: 'scene-3',
          movieId: 'movie-3',
        },
      };

      service.getEventStream().subscribe((event) => {
        expect(event.type).toBe('track_created');
        expect(event.data.trackId).toBe('track-3');
        expect(event.data.movieId).toBe('movie-3');
        done();
      });

      service.emitTrackCreated(mockTrack as any);
    });
  });

  describe('emitTrackUpdated', () => {
    it('should emit track updated events', (done) => {
      const mockTrack = {
        id: 'track-4',
        sceneId: 'scene-4',
        songId: 'song-4',
        startTime: 0,
        endTime: 180,
        currentLicensingStatus: LicensingState.APPROVED,
      };

      service.getEventStream().subscribe((event) => {
        expect(event.type).toBe('track_updated');
        expect(event.data.trackId).toBe('track-4');
        done();
      });

      service.emitTrackUpdated(mockTrack as any);
    });
  });

  describe('emitTrackDeleted', () => {
    it('should emit track deleted events', (done) => {
      service.getEventStream().subscribe((event) => {
        expect(event.type).toBe('track_deleted');
        expect(event.data.trackId).toBe('track-5');
        expect(event.data.sceneId).toBe('scene-5');
        expect(event.data.movieId).toBe('movie-5');
        done();
      });

      service.emitTrackDeleted('track-5', 'scene-5', 'movie-5');
    });
  });
});
