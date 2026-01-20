import { Test, TestingModule } from '@nestjs/testing';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';
import { LicensingStatus } from 'libs/shared';

describe('TrackController (API Gateway)', () => {
  let controller: TrackController;
  let trackService: jest.Mocked<TrackService>;

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

  const mockTrackService = {
    fetch: jest.fn(),
    fetchById: jest.fn(),
    create: jest.fn(),
    updateLicensingStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackController],
      providers: [
        {
          provide: TrackService,
          useValue: mockTrackService,
        },
      ],
    }).compile();

    controller = module.get<TrackController>(TrackController);
    trackService = module.get(TrackService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fetchAll', () => {
    it('should return an array of tracks', async () => {
      const tracks = [mockTrack, { ...mockTrack, id: 2 }];
      mockTrackService.fetch.mockResolvedValue(tracks);

      const result = await controller.fetchAll();

      expect(result).toEqual(tracks);
      expect(result).toHaveLength(2);
      expect(mockTrackService.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no tracks exist', async () => {
      mockTrackService.fetch.mockResolvedValue([]);

      const result = await controller.fetchAll();

      expect(result).toEqual([]);
      expect(mockTrackService.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchById', () => {
    it('should return a track by id', async () => {
      mockTrackService.fetchById.mockResolvedValue(mockTrack);

      const result = await controller.fetchById(1);

      expect(result).toEqual(mockTrack);
      expect(mockTrackService.fetchById).toHaveBeenCalledWith(1);
    });

    it('should return null when track not found', async () => {
      mockTrackService.fetchById.mockResolvedValue(null);

      const result = await controller.fetchById(999);

      expect(result).toBeNull();
      expect(mockTrackService.fetchById).toHaveBeenCalledWith(999);
    });
  });

  describe('create', () => {
    it('should create and return a new track', async () => {
      const createTrackDto: CreateTrackDto = {
        songId: 1,
        movieSceneId: 1,
        startTime: 0,
        endTime: 180,
      };
      mockTrackService.create.mockResolvedValue(mockTrack);

      const result = await controller.create(createTrackDto);

      expect(result).toEqual(mockTrack);
      expect(mockTrackService.create).toHaveBeenCalledWith(createTrackDto);
      expect(mockTrackService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle track with partial song duration', async () => {
      const createTrackDto: CreateTrackDto = {
        songId: 1,
        movieSceneId: 1,
        startTime: 30,
        endTime: 90,
      };
      const partialTrack = { ...mockTrack, startTime: 30, endTime: 90 };
      mockTrackService.create.mockResolvedValue(partialTrack);

      const result = await controller.create(createTrackDto);

      expect(result.startTime).toBe(30);
      expect(result.endTime).toBe(90);
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status to LICENSED', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.LICENSED };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus(1, LicensingStatus.LICENSED);

      expect(result.status).toBe(LicensingStatus.LICENSED);
      expect(mockTrackService.updateLicensingStatus).toHaveBeenCalledWith(
        1,
        LicensingStatus.LICENSED,
      );
    });

    it('should update licensing status to IN_NEGOTIATION', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.IN_NEGOTIATION };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus(1, LicensingStatus.IN_NEGOTIATION);

      expect(result.status).toBe(LicensingStatus.IN_NEGOTIATION);
      expect(mockTrackService.updateLicensingStatus).toHaveBeenCalledWith(
        1,
        LicensingStatus.IN_NEGOTIATION,
      );
    });

    it('should update licensing status to UNLICENSED', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.UNLICENSED };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus(1, LicensingStatus.UNLICENSED);

      expect(result.status).toBe(LicensingStatus.UNLICENSED);
    });
  });
});
