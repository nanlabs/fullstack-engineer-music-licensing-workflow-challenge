/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { UpdateTrackLicenseStatusDto } from './dto/updateTrackLicenseStatus-track.dto';
import { FindAllByMovieIdTrackDto } from './dto/findAllByMovieID-track.dto';
import { FindAllBySceneIdTrackDto } from './dto/findAllBySceneID-track.dto';
import { LicenseStatusEnum } from '../licenses/entities/license.status.enum';

describe('TracksController', () => {
  let controller: TracksController;
  let service: TracksService;

  const mockTracksService = {
    create: jest.fn(),
    findAllByMovieId: jest.fn(),
    findAllBySceneId: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateLicenseStatus: jest.fn(),
    getLicenseHistory: jest.fn(),
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
    it('should create a new track', async () => {
      const createTrackDto: CreateTrackDto = {
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
      };

      const mockTrack = {
        id: 1,
        ...createTrackDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTracksService.create.mockResolvedValue(mockTrack);

      const result = await controller.create(createTrackDto);

      expect(service.create).toHaveBeenCalledWith(createTrackDto);
      expect(result).toEqual(mockTrack);
    });
  });

  describe('findAllByMovieId', () => {
    it('should return paginated tracks for a movie', async () => {
      const movieId = 1;
      const findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [
          {
            id: 1,
            scene_id: 1,
            song_id: 1,
            start_time_seconds: 0,
            end_time_seconds: 30,
            is_deleted: false,
            license: { id: 1, status_id: 1 },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockTracksService.findAllByMovieId.mockResolvedValue(mockResponse);

      const result = await controller.findAllByMovieId(
        movieId,
        findAllByMovieIdTrackDto,
      );

      expect(service.findAllByMovieId).toHaveBeenCalledWith(
        movieId,
        findAllByMovieIdTrackDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use ParseIntPipe to convert movieId', async () => {
      const movieId = 123;
      const findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto = {};

      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockTracksService.findAllByMovieId.mockResolvedValue(mockResponse);

      const result = await controller.findAllByMovieId(
        movieId,
        findAllByMovieIdTrackDto,
      );

      expect(service.findAllByMovieId).toHaveBeenCalledWith(
        movieId,
        findAllByMovieIdTrackDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findAllBySceneId', () => {
    it('should return paginated tracks for a scene', async () => {
      const sceneId = 1;
      const findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [
          {
            id: 1,
            scene_id: 1,
            song_id: 1,
            start_time_seconds: 0,
            end_time_seconds: 30,
            is_deleted: false,
            license: { id: 1, status_id: 1 },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockTracksService.findAllBySceneId.mockResolvedValue(mockResponse);

      const result = await controller.findAllBySceneId(
        sceneId,
        findAllBySceneIdTrackDto,
      );

      expect(service.findAllBySceneId).toHaveBeenCalledWith(
        sceneId,
        findAllBySceneIdTrackDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use ParseIntPipe to convert sceneId', async () => {
      const sceneId = 456;
      const findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto = {};

      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockTracksService.findAllBySceneId.mockResolvedValue(mockResponse);

      const result = await controller.findAllBySceneId(
        sceneId,
        findAllBySceneIdTrackDto,
      );

      expect(service.findAllBySceneId).toHaveBeenCalledWith(
        sceneId,
        findAllBySceneIdTrackDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOne', () => {
    it('should return a track by id', async () => {
      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTracksService.findOne.mockResolvedValue(mockTrack);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTrack);
    });

    it('should convert string id to number', async () => {
      const mockTrack = {
        id: 123,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTracksService.findOne.mockResolvedValue(mockTrack);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockTrack);
    });
  });

  describe('update', () => {
    it('should update a track', async () => {
      const updateTrackDto: UpdateTrackDto = {
        start_time_seconds: 10,
        end_time_seconds: 40,
      };

      const updatedTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 10,
        end_time_seconds: 40,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTracksService.update.mockResolvedValue(updatedTrack);

      const result = await controller.update('1', updateTrackDto);

      expect(service.update).toHaveBeenCalledWith(1, updateTrackDto);
      expect(result).toEqual(updatedTrack);
    });

    it('should convert string id to number', async () => {
      const updateTrackDto: UpdateTrackDto = {
        start_time_seconds: 10,
      };

      const updatedTrack = {
        id: 456,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 10,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTracksService.update.mockResolvedValue(updatedTrack);

      const result = await controller.update('456', updateTrackDto);

      expect(service.update).toHaveBeenCalledWith(456, updateTrackDto);
      expect(result).toEqual(updatedTrack);
    });
  });

  describe('updateLicenseStatus', () => {
    it('should update license status for a track', async () => {
      const updateLicenseStatusDto: UpdateTrackLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      mockTracksService.updateLicenseStatus.mockResolvedValue(undefined);

      const result = await controller.updateLicenseStatus(
        '1',
        updateLicenseStatusDto,
      );

      expect(service.updateLicenseStatus).toHaveBeenCalledWith(
        1,
        updateLicenseStatusDto,
      );
      expect(result).toBeUndefined();
    });

    it('should convert string id to number', async () => {
      const updateLicenseStatusDto: UpdateTrackLicenseStatusDto = {
        status: LicenseStatusEnum.REJECTED,
      };

      mockTracksService.updateLicenseStatus.mockResolvedValue(undefined);

      const result = await controller.updateLicenseStatus(
        '789',
        updateLicenseStatusDto,
      );

      expect(service.updateLicenseStatus).toHaveBeenCalledWith(
        789,
        updateLicenseStatusDto,
      );
      expect(result).toBeUndefined();
    });

    it('should handle different license statuses', async () => {
      const statuses = [
        LicenseStatusEnum.PENDING,
        LicenseStatusEnum.IN_NEGOTIATION,
        LicenseStatusEnum.APPROVED,
        LicenseStatusEnum.REJECTED,
        LicenseStatusEnum.CANCELLED,
      ];

      for (const status of statuses) {
        const updateLicenseStatusDto: UpdateTrackLicenseStatusDto = {
          status,
        };

        mockTracksService.updateLicenseStatus.mockResolvedValue(undefined);

        await controller.updateLicenseStatus('1', updateLicenseStatusDto);

        expect(service.updateLicenseStatus).toHaveBeenCalledWith(1, {
          status,
        });
      }

      expect(mockTracksService.updateLicenseStatus).toHaveBeenCalledTimes(5);
    });
  });

  describe('getLicenseHistory', () => {
    it('should return license history for a track', async () => {
      const mockHistory = [
        {
          id: 1,
          license_id: 1,
          status_id: 1,
          created_at: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 2,
          license_id: 1,
          status_id: 2,
          created_at: new Date('2024-01-15T10:30:00Z'),
        },
      ];

      mockTracksService.getLicenseHistory.mockResolvedValue(mockHistory);

      const result = await controller.getLicenseHistory('1');

      expect(service.getLicenseHistory).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockHistory);
    });

    it('should convert string id to number', async () => {
      const mockHistory = [
        {
          id: 1,
          license_id: 1,
          status_id: 1,
          created_at: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      mockTracksService.getLicenseHistory.mockResolvedValue(mockHistory);

      const result = await controller.getLicenseHistory('123');

      expect(service.getLicenseHistory).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when track has no license history', async () => {
      const mockHistory = [];

      mockTracksService.getLicenseHistory.mockResolvedValue(mockHistory);

      const result = await controller.getLicenseHistory('1');

      expect(service.getLicenseHistory).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockHistory);
    });
  });

  describe('remove', () => {
    it('should remove a track', async () => {
      mockTracksService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });

    it('should convert string id to number', async () => {
      mockTracksService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('999');

      expect(service.remove).toHaveBeenCalledWith(999);
      expect(result).toBeUndefined();
    });
  });
});
