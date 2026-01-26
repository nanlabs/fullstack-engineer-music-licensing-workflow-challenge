import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TracksService } from '../../src/tracks/tracks.service';
import { Track, LicensingState } from '../../src/entities/track.entity';
import { LicensingStatus } from '../../src/entities/licensing-status.entity';
import { Scene } from '../../src/entities/scene.entity';
import { Song } from '../../src/entities/song.entity';
import { CreateTrackDto } from '../../src/tracks/dto/create-track.dto';
import { UpdateLicensingStatusDto } from '../../src/tracks/dto/update-licensing-status.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RealtimeService } from '../../src/realtime/realtime.service';

describe('TracksService', () => {
  let service: TracksService;

  const mockMovie = {
    id: 'movie-1',
    title: 'Test Movie',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScene: Scene = {
    id: 'scene-1',
    movieId: 'movie-1',
    movie: mockMovie as any,
    title: 'Test Scene',
    tracks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSong: Song = {
    id: 'song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    tracks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTrack: Track = {
    id: '1',
    sceneId: 'scene-1',
    songId: 'song-1',
    startTime: 0,
    endTime: 180,
    currentLicensingStatus: LicensingState.PENDING,
    scene: mockScene,
    song: mockSong,
    licensingStatusHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTrackRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLicensingStatusRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSceneRepository = {
    findOne: jest.fn(),
  };

  const mockSongRepository = {
    findOne: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    isTransactionActive: true,
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockRealtimeService = {
    emitLicensingStatusUpdate: jest.fn(),
    emitTrackCreated: jest.fn(),
    emitTrackUpdated: jest.fn(),
    emitTrackDeleted: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        'app.pagination.defaultPage': 1,
        'app.pagination.defaultLimit': 10,
        'app.pagination.maxLimit': 100,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: getRepositoryToken(Track),
          useValue: mockTrackRepository,
        },
        {
          provide: getRepositoryToken(LicensingStatus),
          useValue: mockLicensingStatusRepository,
        },
        {
          provide: getRepositoryToken(Scene),
          useValue: mockSceneRepository,
        },
        {
          provide: getRepositoryToken(Song),
          useValue: mockSongRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: RealtimeService,
          useValue: mockRealtimeService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a track with initial licensing status', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
      };

      const mockScene = { id: 'scene-1', title: 'Test Scene' };
      const mockSong = { id: 'song-1', title: 'Test Song' };
      const createdTrack = { ...mockTrack, ...createDto };
      const initialStatus = {
        id: 'status-1',
        trackId: '1',
        status: LicensingState.PENDING,
        notes: 'Track created, awaiting licensing request',
        updatedBy: 'system',
        track: null,
        createdAt: new Date(),
      };

      mockSceneRepository.findOne.mockResolvedValue(mockScene);
      mockSongRepository.findOne.mockResolvedValue(mockSong);
      mockTrackRepository.create.mockReturnValue(createdTrack);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(createdTrack)
        .mockResolvedValueOnce(initialStatus);
      mockTrackRepository.findOne.mockResolvedValue({
        ...createdTrack,
        licensingStatusHistory: [initialStatus],
      });

      const result = await service.create(createDto);

      expect(mockSceneRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.sceneId },
      });
      expect(mockSongRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.songId },
      });
      expect(mockTrackRepository.create).toHaveBeenCalledWith({
        ...createDto,
        currentLicensingStatus: LicensingState.PENDING,
      });
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if scene not found', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
      };

      mockSceneRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if song not found', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
      };

      mockSceneRepository.findOne.mockResolvedValue({ id: 'scene-1' });
      mockSongRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if endTime <= startTime', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 100,
        endTime: 50,
      };

      mockSceneRepository.findOne.mockResolvedValue({ id: 'scene-1' });
      mockSongRepository.findOne.mockResolvedValue({ id: 'song-1' });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle errors when creating track', async () => {
      const createDto: CreateTrackDto = {
        sceneId: 'scene-1',
        songId: 'song-1',
        startTime: 0,
        endTime: 180,
      };

      mockSceneRepository.findOne.mockResolvedValue({ id: 'scene-1' });
      mockSongRepository.findOne.mockResolvedValue({ id: 'song-1' });
      mockQueryRunner.manager.save.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated result of tracks', async () => {
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
      mockTrackRepository.findAndCount.mockResolvedValue([[mockTrack], 1]);

      const result = await service.findAll(1, 10);

      expect(mockTrackRepository.findAndCount).toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findByScene', () => {
    it('should return tracks for a specific scene', async () => {
      mockTrackRepository.find.mockResolvedValue([mockTrack]);

      const result = await service.findByScene('scene-1');

      expect(mockTrackRepository.find).toHaveBeenCalledWith({
        where: { sceneId: 'scene-1' },
        relations: ['song', 'licensingStatusHistory'],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([mockTrack]);
    });
  });

  describe('findByMovie', () => {
    it('should return tracks for a specific movie', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrack]),
      };

      mockTrackRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByMovie('movie-1');

      expect(mockTrackRepository.createQueryBuilder).toHaveBeenCalledWith(
        'track',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'scene.movieId = :movieId',
        {
          movieId: 'movie-1',
        },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'track.createdAt',
        'ASC',
      );
      expect(result).toEqual([mockTrack]);
    });
  });

  describe('findOne', () => {
    it('should return a track by id', async () => {
      mockTrackRepository.findOne.mockResolvedValue(mockTrack);

      const result = await service.findOne('1');

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['scene', 'scene.movie', 'song', 'licensingStatusHistory'],
        order: {
          licensingStatusHistory: {
            createdAt: 'DESC',
          },
        },
      });
      expect(result).toEqual(mockTrack);
    });

    it('should throw NotFoundException if track not found', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a track', async () => {
      mockTrackRepository.findOne.mockResolvedValue(mockTrack);
      mockTrackRepository.remove.mockResolvedValue(mockTrack);

      await service.remove('1');

      expect(mockTrackRepository.findOne).toHaveBeenCalled();
      expect(mockTrackRepository.remove).toHaveBeenCalledWith(mockTrack);
    });
  });

  describe('updateLicensingStatus', () => {
    it('should update licensing status and create history entry', async () => {
      const updateDto: UpdateLicensingStatusDto = {
        status: LicensingState.NEGOTIATING,
        notes: 'Negotiating terms',
        updatedBy: 'admin',
      };

      const newStatus = {
        id: 'status-2',
        trackId: '1',
        status: LicensingState.NEGOTIATING,
        notes: 'Negotiating terms',
        updatedBy: 'admin',
        track: null,
        createdAt: new Date(),
      };

      const updatedTrack = {
        ...mockTrack,
        currentLicensingStatus: LicensingState.NEGOTIATING,
        licensingStatusHistory: [newStatus],
      };

      mockTrackRepository.findOne
        .mockResolvedValueOnce(mockTrack)
        .mockResolvedValueOnce(updatedTrack);
      // Mock queryRunner.manager.findOne to return track in transaction
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockTrack,
        id: '1',
      });
      mockLicensingStatusRepository.create.mockReturnValue(newStatus);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(newStatus)
        .mockResolvedValueOnce({
          ...mockTrack,
          currentLicensingStatus: LicensingState.NEGOTIATING,
        });

      const result = await service.updateLicensingStatus('1', updateDto);

      expect(mockLicensingStatusRepository.create).toHaveBeenCalledWith({
        trackId: '1',
        status: LicensingState.NEGOTIATING,
        notes: 'Negotiating terms',
        updatedBy: 'admin',
      });
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.currentLicensingStatus).toBe(LicensingState.NEGOTIATING);
      expect(mockRealtimeService.emitLicensingStatusUpdate).toHaveBeenCalledWith(
        updatedTrack,
        LicensingState.PENDING,
        LicensingState.NEGOTIATING,
        'Negotiating terms',
        'admin',
      );
    });

    it('should throw BadRequestException if updating to same status', async () => {
      const updateDto: UpdateLicensingStatusDto = {
        status: LicensingState.PENDING,
        notes: 'Same status',
      };

      await expect(
        service.updateLicensingStatus('1', updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle transaction errors', async () => {
      const updateDto: UpdateLicensingStatusDto = {
        status: LicensingState.NEGOTIATING,
        notes: 'Test',
      };

      const trackWithPendingStatus = {
        ...mockTrack,
        currentLicensingStatus: LicensingState.PENDING,
      };

      mockTrackRepository.findOne.mockResolvedValue(trackWithPendingStatus);
      // Mock queryRunner.manager.findOne to return track in transaction
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...trackWithPendingStatus,
        id: '1',
      });
      mockLicensingStatusRepository.create.mockReturnValue({
        id: 'status-2',
        trackId: '1',
        status: LicensingState.NEGOTIATING,
      });
      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({
          id: 'status-2',
          trackId: '1',
          status: LicensingState.NEGOTIATING,
        })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.updateLicensingStatus('1', updateDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException if track not found', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateLicensingStatus('1', {
          status: LicensingState.NEGOTIATING,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
