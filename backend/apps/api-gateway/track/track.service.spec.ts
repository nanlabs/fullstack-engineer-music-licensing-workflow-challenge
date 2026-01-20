import { Test, TestingModule } from '@nestjs/testing';
import { TrackService } from './track.service';
import { ClientRMQ } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { LicensingStatus } from 'libs/shared';

describe('TrackService (API Gateway)', () => {
  let service: TrackService;

  const mockSong = {
    id: 1,
    title: 'Bohemian Rhapsody',
    releaseDate: 1975,
    seconds: 354,
  };

  const mockMovie = {
    id: 1,
    title: "Wayne's World",
    releaseDate: 1992,
    encodingFormat: 'Blu-ray',
  };

  const mockMovieScene = {
    id: 1,
    name: 'Car singing scene',
    movie: mockMovie,
  };

  const mockLicensing = {
    id: 1,
    status: LicensingStatus.UNLICENSED,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTrack = {
    id: 1,
    startTime: 0,
    endTime: 180,
    song: mockSong,
    movieScene: mockMovieScene,
    licensing: mockLicensing,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTrackMicroserviceClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackService,
        {
          provide: 'TRACK_SERVICE',
          useValue: mockTrackMicroserviceClient,
        },
      ],
    }).compile();

    service = module.get<TrackService>(TrackService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetch', () => {
    it('should return an array of tracks from microservice', async () => {
      const tracks = [mockTrack, { ...mockTrack, id: 2 }];
      mockTrackMicroserviceClient.send.mockReturnValue(of(tracks));

      const result = await service.fetch();

      expect(result).toEqual(tracks);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.fetch.all', {});
    });

    it('should return empty array when no tracks exist', async () => {
      mockTrackMicroserviceClient.send.mockReturnValue(of([]));

      const result = await service.fetch();

      expect(result).toEqual([]);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.fetch.all', {});
    });

    it('should propagate errors from microservice', async () => {
      const error = new Error('Microservice unavailable');
      mockTrackMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(service.fetch()).rejects.toThrow('Microservice unavailable');
    });
  });

  describe('fetchById', () => {
    it('should return a track by id from microservice', async () => {
      mockTrackMicroserviceClient.send.mockReturnValue(of(mockTrack));

      const result = await service.fetchById(1);

      expect(result).toEqual(mockTrack);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.fetch.byId', { id: 1 });
    });

    it('should return null when track not found', async () => {
      mockTrackMicroserviceClient.send.mockReturnValue(of(null));

      const result = await service.fetchById(999);

      expect(result).toBeNull();
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.fetch.byId', { id: 999 });
    });

    it('should propagate errors from microservice', async () => {
      const error = new Error('Track fetch failed');
      mockTrackMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(service.fetchById(1)).rejects.toThrow('Track fetch failed');
    });
  });

  describe('create', () => {
    it('should create and return a new track via microservice', async () => {
      const createTrackDto: CreateTrackDto = {
        songId: 1,
        movieSceneId: 1,
        startTime: 0,
        endTime: 180,
      };
      mockTrackMicroserviceClient.send.mockReturnValue(of(mockTrack));

      const result = await service.create(createTrackDto);

      expect(result).toEqual(mockTrack);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith(
        'track.create.one',
        createTrackDto,
      );
    });

    it('should propagate errors when creating track fails', async () => {
      const createTrackDto: CreateTrackDto = {
        songId: 1,
        movieSceneId: 1,
        startTime: 0,
        endTime: 180,
      };
      const error = new Error('Creation failed');
      mockTrackMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(service.create(createTrackDto)).rejects.toThrow('Creation failed');
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status to LICENSED via microservice', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.LICENSED };
      mockTrackMicroserviceClient.send.mockReturnValue(of(updatedLicensing));

      const result = await service.updateLicensingStatus(1, LicensingStatus.LICENSED);

      expect(result.status).toBe(LicensingStatus.LICENSED);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.update.licensing', {
        trackId: 1,
        status: LicensingStatus.LICENSED,
      });
    });

    it('should update licensing status to IN_NEGOTIATION via microservice', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.IN_NEGOTIATION };
      mockTrackMicroserviceClient.send.mockReturnValue(of(updatedLicensing));

      const result = await service.updateLicensingStatus(1, LicensingStatus.IN_NEGOTIATION);

      expect(result.status).toBe(LicensingStatus.IN_NEGOTIATION);
      expect(mockTrackMicroserviceClient.send).toHaveBeenCalledWith('track.update.licensing', {
        trackId: 1,
        status: LicensingStatus.IN_NEGOTIATION,
      });
    });

    it('should propagate errors when update fails', async () => {
      const error = new Error('Update failed');
      mockTrackMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(
        service.updateLicensingStatus(1, LicensingStatus.LICENSED),
      ).rejects.toThrow('Update failed');
    });
  });
});
