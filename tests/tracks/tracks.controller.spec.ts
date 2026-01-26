import { Test, TestingModule } from '@nestjs/testing';
import { TracksController } from '../../src/tracks/tracks.controller';
import { TracksService } from '../../src/tracks/tracks.service';
import { CreateTrackDto } from '../../src/tracks/dto/create-track.dto';
import { UpdateLicensingStatusDto } from '../../src/tracks/dto/update-licensing-status.dto';
import { LicensingState } from '../../src/entities/track.entity';

describe('TracksController', () => {
  let controller: TracksController;
  let service: TracksService;

  const mockTrack = {
    id: '1',
    sceneId: 'scene-1',
    songId: 'song-1',
    startTime: 0,
    endTime: 180,
    currentLicensingStatus: LicensingState.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTracksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByScene: jest.fn(),
    findByMovie: jest.fn(),
    findOne: jest.fn(),
    updateLicensingStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TracksController],
      providers: [
        {
          provide: TracksService,
          useValue: mockTracksService,
        },
      ],
    }).compile();

    controller = module.get<TracksController>(TracksController);
    service = module.get<TracksService>(TracksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a track', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
      };

      mockTracksService.create.mockResolvedValue(mockTrack);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockTrack);
    });
  });

  describe('findAll', () => {
    it('should return all tracks when no query params', async () => {
      const paginatedResult = {
        data: [mockTrack],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockTracksService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(undefined, undefined, '1', '10');

      expect(service.findAll).toHaveBeenCalledWith(1, 10);
      expect(service.findByScene).not.toHaveBeenCalled();
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });

    it('should return all tracks with default pagination when page/limit not provided', async () => {
      const paginatedResult = {
        data: [mockTrack],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockTracksService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(undefined, undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(service.findByScene).not.toHaveBeenCalled();
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });

    it('should return tracks by scene when sceneId query param provided', async () => {
      mockTracksService.findByScene.mockResolvedValue([mockTrack]);

      const result = await controller.findAll('scene-1', undefined, undefined, undefined);

      expect(service.findByScene).toHaveBeenCalledWith('scene-1');
      expect(service.findAll).not.toHaveBeenCalled();
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual([mockTrack]);
    });

    it('should return tracks by movie when movieId query param provided', async () => {
      mockTracksService.findByMovie.mockResolvedValue([mockTrack]);

      const result = await controller.findAll(undefined, 'movie-1', undefined, undefined);

      expect(service.findByMovie).toHaveBeenCalledWith('movie-1');
      expect(service.findAll).not.toHaveBeenCalled();
      expect(service.findByScene).not.toHaveBeenCalled();
      expect(result).toEqual([mockTrack]);
    });

    it('should prioritize sceneId over movieId when both provided', async () => {
      mockTracksService.findByScene.mockResolvedValue([mockTrack]);

      const result = await controller.findAll('scene-1', 'movie-1', undefined, undefined);

      expect(service.findByScene).toHaveBeenCalledWith('scene-1');
      expect(service.findByMovie).not.toHaveBeenCalled();
      expect(result).toEqual([mockTrack]);
    });
  });

  describe('findOne', () => {
    it('should return a track by id', async () => {
      mockTracksService.findOne.mockResolvedValue(mockTrack);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockTrack);
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status', async () => {
      const updateDto: UpdateLicensingStatusDto = {
        status: LicensingState.APPROVED,
        notes: 'License approved',
        updatedBy: 'admin',
      };

      const updatedTrack = {
        ...mockTrack,
        currentLicensingStatus: LicensingState.APPROVED,
      };

      mockTracksService.updateLicensingStatus.mockResolvedValue(updatedTrack);

      const result = await controller.updateLicensingStatus('1', updateDto);

      expect(service.updateLicensingStatus).toHaveBeenCalledWith(
        '1',
        updateDto,
      );
      expect(result).toEqual(updatedTrack);
    });
  });

  describe('remove', () => {
    it('should delete a track', async () => {
      mockTracksService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
