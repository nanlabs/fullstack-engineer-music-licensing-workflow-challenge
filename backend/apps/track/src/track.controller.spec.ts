import { Test, TestingModule } from '@nestjs/testing';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';
import { LicensingStatus } from 'libs/shared';
import { CreateTrackDto } from 'libs/shared/dto/create-track.dto';

describe('TrackController (Microservice)', () => {
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
    title: 'Wayne\'s World',
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
    findAll: jest.fn(),
    findById: jest.fn(),
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

  describe('fetchAllTracks', () => {
    it('should return an array of tracks with relations', async () => {
      const tracks = [mockTrack, { ...mockTrack, id: 2 }];
      mockTrackService.findAll.mockResolvedValue(tracks);

      const result = await controller.fetchAllTracks();

      expect(result).toEqual(tracks);
      expect(result).toHaveLength(2);
      expect(result[0].song).toBeDefined();
      expect(result[0].movieScene).toBeDefined();
      expect(result[0].licensing).toBeDefined();
      expect(mockTrackService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no tracks exist', async () => {
      mockTrackService.findAll.mockResolvedValue([]);

      const result = await controller.fetchAllTracks();

      expect(result).toEqual([]);
      expect(mockTrackService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchTrackById', () => {
    it('should return a track by id with relations', async () => {
      mockTrackService.findById.mockResolvedValue(mockTrack);

      const result = await controller.fetchTrackById({ id: 1 });

      expect(result).toEqual(mockTrack);
      expect(result.song).toBeDefined();
      expect(result.movieScene).toBeDefined();
      expect(result.licensing).toBeDefined();
      expect(mockTrackService.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when track not found', async () => {
      mockTrackService.findById.mockResolvedValue(null);

      const result = await controller.fetchTrackById({ id: 999 });

      expect(result).toBeNull();
      expect(mockTrackService.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('createOne', () => {
    it('should create and return a new track', async () => {
      const createTrackDto: CreateTrackDto = {
        songId: 1,
        movieSceneId: 1,
        startTime: 0,
        endTime: 180,
      };
      mockTrackService.create.mockResolvedValue(mockTrack);

      const result = await controller.createOne(createTrackDto);

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

      const result = await controller.createOne(createTrackDto);

      expect(result.startTime).toBe(30);
      expect(result.endTime).toBe(90);
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status to LICENSED', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.LICENSED };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus({
        trackId: 1,
        status: LicensingStatus.LICENSED,
      });

      expect(result.status).toBe(LicensingStatus.LICENSED);
      expect(mockTrackService.updateLicensingStatus).toHaveBeenCalledWith(
        1,
        LicensingStatus.LICENSED,
      );
    });

    it('should update licensing status to IN_NEGOTIATION', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.IN_NEGOTIATION };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus({
        trackId: 1,
        status: LicensingStatus.IN_NEGOTIATION,
      });

      expect(result.status).toBe(LicensingStatus.IN_NEGOTIATION);
      expect(mockTrackService.updateLicensingStatus).toHaveBeenCalledWith(
        1,
        LicensingStatus.IN_NEGOTIATION,
      );
    });

    it('should update licensing status to UNLICENSED', async () => {
      const updatedLicensing = { ...mockLicensing, status: LicensingStatus.UNLICENSED };
      mockTrackService.updateLicensingStatus.mockResolvedValue(updatedLicensing);

      const result = await controller.updateLicensingStatus({
        trackId: 1,
        status: LicensingStatus.UNLICENSED,
      });

      expect(result.status).toBe(LicensingStatus.UNLICENSED);
    });
  });
});
