import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TracksService } from './tracks.service';
import { Track } from './entities/track.entity';
import { Song } from '../songs/entities/song.entity';
import { Scene } from '../scenes/entities/scene.entity';
import { Movie } from '../movies/entities/movie.entity';
import { LicensesService } from '../licenses/licenses.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { UpdateTrackLicenseStatusDto } from './dto/updateTrackLicenseStatus-track.dto';
import { FindAllByMovieIdTrackDto } from './dto/findAllByMovieID-track.dto';
import { FindAllBySceneIdTrackDto } from './dto/findAllBySceneID-track.dto';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';
import { LicenseStatusEnum } from '../licenses/entities/license.status.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';

describe('TracksService', () => {
  let service: TracksService;

  const mockTrackRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockSongRepository = {
    findOneBy: jest.fn(),
  };

  const mockSceneRepository = {
    findOneBy: jest.fn(),
  };

  const mockMovieRepository = {
    findOneBy: jest.fn(),
  };

  const mockLicensesService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    getHistory: jest.fn(),
    remove: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn((key: string) => key),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockRedisClient = null; // In tests, Redis is not available

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: getRepositoryToken(Track),
          useValue: mockTrackRepository,
        },
        {
          provide: getRepositoryToken(Song),
          useValue: mockSongRepository,
        },
        {
          provide: getRepositoryToken(Scene),
          useValue: mockSceneRepository,
        },
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
        },
        {
          provide: LicensesService,
          useValue: mockLicensesService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(null);
  });

  describe('create', () => {
    it('should create a new track', async () => {
      const createTrackDto: CreateTrackDto = {
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
      };

      const mockSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
      };

      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Description',
        is_deleted: false,
      };

      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        scene: mockScene,
        song: mockSong,
      };

      mockSongRepository.findOneBy.mockResolvedValue(mockSong);
      mockSceneRepository.findOneBy.mockResolvedValue(mockScene);
      mockTrackRepository.create.mockReturnValue(mockTrack);
      mockTrackRepository.save.mockResolvedValue(mockTrack);
      mockLicensesService.create.mockResolvedValue({});

      const result = await service.create(createTrackDto);

      expect(mockSongRepository.findOneBy).toHaveBeenCalledWith({
        id: createTrackDto.song_id,
        is_deleted: false,
      });
      expect(mockSceneRepository.findOneBy).toHaveBeenCalledWith({
        id: createTrackDto.scene_id,
        is_deleted: false,
      });
      expect(mockTrackRepository.create).toHaveBeenCalledWith({
        scene: mockScene,
        song: mockSong,
        start_time_seconds: createTrackDto.start_time_seconds,
        end_time_seconds: createTrackDto.end_time_seconds,
      });
      expect(mockTrackRepository.save).toHaveBeenCalledWith(mockTrack);
      expect(mockLicensesService.create).toHaveBeenCalledWith({
        track_id: mockTrack.id,
      });
      expect(result).toEqual(mockTrack);
    });

    it('should throw I18nException when song is not found', async () => {
      const createTrackDto: CreateTrackDto = {
        scene_id: 1,
        song_id: 999,
        start_time_seconds: 0,
        end_time_seconds: 30,
      };

      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Description',
        is_deleted: false,
      };

      mockSongRepository.findOneBy.mockResolvedValue(null);
      mockSceneRepository.findOneBy.mockResolvedValue(mockScene);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.create(createTrackDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockTrackRepository.create).not.toHaveBeenCalled();
    });

    it('should throw I18nException when scene is not found', async () => {
      const createTrackDto: CreateTrackDto = {
        scene_id: 999,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
      };

      const mockSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
      };

      mockSongRepository.findOneBy.mockResolvedValue(mockSong);
      mockSceneRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.create(createTrackDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockTrackRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllByMovieId', () => {
    it('should return paginated tracks for a movie', async () => {
      const movieId = 1;
      const findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto = {
        page: 1,
        limit: 10,
      };

      const mockMovie = {
        id: 1,
        title: 'Test Movie',
        description: 'Description',
        is_deleted: false,
      };

      const mockTracks = [
        {
          id: 1,
          scene_id: 1,
          song_id: 1,
          start_time_seconds: 0,
          end_time_seconds: 30,
          is_deleted: false,
          license: { id: 1, status_id: 1 },
        },
      ];

      mockMovieRepository.findOneBy.mockResolvedValue(mockMovie);
      mockTrackRepository.findAndCount.mockResolvedValue([mockTracks, 1]);

      const result = await service.findAllByMovieId(
        movieId,
        findAllByMovieIdTrackDto,
      );

      expect(mockMovieRepository.findOneBy).toHaveBeenCalledWith({
        id: movieId,
        is_deleted: false,
      });
      expect(mockTrackRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          scene: { movie_id: movieId },
          is_deleted: false,
        },
        relations: {
          license: true,
        },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockTracks);
      expect((result as any).pagination).toBeDefined();
    });

    it('should throw I18nException when movie is not found', async () => {
      const movieId = 999;
      const findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto = {
        page: 1,
        limit: 10,
      };

      mockMovieRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(
        service.findAllByMovieId(movieId, findAllByMovieIdTrackDto),
      ).rejects.toThrow(I18nException);
      expect(mockTrackRepository.findAndCount).not.toHaveBeenCalled();
    });
  });

  describe('findAllBySceneId', () => {
    it('should return paginated tracks for a scene', async () => {
      const sceneId = 1;
      const findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto = {
        page: 1,
        limit: 10,
      };

      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Description',
        is_deleted: false,
      };

      const mockTracks = [
        {
          id: 1,
          scene_id: 1,
          song_id: 1,
          start_time_seconds: 0,
          end_time_seconds: 30,
          is_deleted: false,
          license: { id: 1, status_id: 1 },
        },
      ];

      mockSceneRepository.findOneBy.mockResolvedValue(mockScene);
      mockTrackRepository.findAndCount.mockResolvedValue([mockTracks, 1]);

      const result = await service.findAllBySceneId(
        sceneId,
        findAllBySceneIdTrackDto,
      );

      expect(mockSceneRepository.findOneBy).toHaveBeenCalledWith({
        id: sceneId,
        is_deleted: false,
      });
      expect(mockTrackRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          is_deleted: false,
          scene: { id: sceneId },
        },
        relations: {
          license: true,
        },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockTracks);
      expect((result as any).pagination).toBeDefined();
    });

    it('should throw I18nException when scene is not found', async () => {
      const sceneId = 999;
      const findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto = {
        page: 1,
        limit: 10,
      };

      mockSceneRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(
        service.findAllBySceneId(sceneId, findAllBySceneIdTrackDto),
      ).rejects.toThrow(I18nException);
      expect(mockTrackRepository.findAndCount).not.toHaveBeenCalled();
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
        scene: {
          id: 1,
          movie_id: 1,
        },
      };

      mockTrackRepository.findOne.mockResolvedValue(mockTrack);

      const result = await service.findOne(1);

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
        relations: {
          scene: true,
          license: {
            status: true,
          },
        },
      });
      expect(result).toEqual(mockTrack);
    });

    it('should throw I18nException when track is not found', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.findOne(999)).rejects.toThrow(I18nException);
      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
        relations: {
          scene: true,
          license: {
            status: true,
          },
        },
      });
    });
  });

  describe('update', () => {
    it('should update a track', async () => {
      const updateTrackDto: UpdateTrackDto = {
        start_time_seconds: 10,
        end_time_seconds: 40,
      };

      const existingTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedTrack = {
        ...existingTrack,
        ...updateTrackDto,
        scene: { id: 1, movie_id: 1 },
      };

      mockTrackRepository.findOne.mockResolvedValue({
        ...existingTrack,
        scene: { id: 1, movie_id: 1 },
      });
      mockTrackRepository.save.mockResolvedValue(updatedTrack);

      const result = await service.update(1, updateTrackDto);

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
        relations: { scene: true },
      });
      expect(mockTrackRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateTrackDto),
      );
      expect(result).toEqual(updatedTrack);
    });

    it('should update only start_time_seconds', async () => {
      const updateTrackDto: UpdateTrackDto = {
        start_time_seconds: 10,
      };

      const existingTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedTrack = {
        ...existingTrack,
        start_time_seconds: 10,
        scene: { id: 1, movie_id: 1 },
      };

      mockTrackRepository.findOne.mockResolvedValue({
        ...existingTrack,
        scene: { id: 1, movie_id: 1 },
      });
      mockTrackRepository.save.mockResolvedValue(updatedTrack);

      const result = await service.update(1, updateTrackDto);

      expect(result.start_time_seconds).toBe(10);
      expect(result.end_time_seconds).toBe(30);
    });

    it('should throw I18nException when track is not found', async () => {
      const updateTrackDto: UpdateTrackDto = {
        start_time_seconds: 10,
      };

      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.update(999, updateTrackDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
        relations: { scene: true },
      });
      expect(mockTrackRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateLicenseStatus', () => {
    it('should update license status for a track', async () => {
      const updateLicenseStatusDto: UpdateTrackLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      const mockTrack = {
        id: 1,
        license: {
          id: 1,
        },
      };

      mockTrackRepository.findOne.mockResolvedValue(mockTrack);
      mockLicensesService.updateStatus.mockResolvedValue(undefined);

      await service.updateLicenseStatus(1, updateLicenseStatusDto);

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
        relations: { license: true },
        select: {
          id: true,
          license: {
            id: true,
          },
        },
      });
      expect(mockLicensesService.updateStatus).toHaveBeenCalledWith(
        mockTrack.license.id,
        { status: LicenseStatusEnum.APPROVED },
      );
    });

    it('should throw I18nException when track is not found', async () => {
      const updateLicenseStatusDto: UpdateTrackLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(
        service.updateLicenseStatus(999, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicensesService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('getLicenseHistory', () => {
    it('should return license history for a track', async () => {
      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        license: {
          id: 1,
        },
      };

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

      mockTrackRepository.findOne.mockResolvedValue(mockTrack);
      mockLicensesService.getHistory.mockResolvedValue(mockHistory);

      const result = await service.getLicenseHistory(1);

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
        relations: { license: true },
      });
      expect(mockLicensesService.getHistory).toHaveBeenCalledWith(
        mockTrack.license.id,
      );
      expect(result).toEqual(mockHistory);
    });

    it('should throw I18nException when track is not found', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.getLicenseHistory(999)).rejects.toThrow(
        I18nException,
      );
      expect(mockLicensesService.getHistory).not.toHaveBeenCalled();
    });

    it('should return empty array when license has no history', async () => {
      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        license: {
          id: 1,
        },
      };

      const mockHistory = [];

      mockTrackRepository.findOne.mockResolvedValue(mockTrack);
      mockLicensesService.getHistory.mockResolvedValue(mockHistory);

      const result = await service.getLicenseHistory(1);

      expect(mockLicensesService.getHistory).toHaveBeenCalledWith(
        mockTrack.license.id,
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe('remove', () => {
    it('should soft delete a track', async () => {
      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
        license: {
          id: 1,
        },
        scene: {
          id: 1,
          movie_id: 1,
        },
      };

      const deletedTrack = {
        ...mockTrack,
        is_deleted: true,
      };

      mockTrackRepository.findOne.mockResolvedValue(mockTrack);
      mockTrackRepository.save.mockResolvedValue(deletedTrack);
      mockLicensesService.remove.mockResolvedValue(undefined);

      await service.remove(1);

      expect(mockTrackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
        relations: { license: true, scene: true },
      });
      expect(mockTrackRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: true }),
      );
      expect(mockLicensesService.remove).toHaveBeenCalledWith(1);
    });

    it('should throw I18nException when track is not found', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.remove(999)).rejects.toThrow(I18nException);
      expect(mockTrackRepository.save).not.toHaveBeenCalled();
      expect(mockLicensesService.remove).not.toHaveBeenCalled();
    });

    it('should throw I18nException when track is already deleted', async () => {
      mockTrackRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.remove(1)).rejects.toThrow(I18nException);
      expect(mockTrackRepository.save).not.toHaveBeenCalled();
      expect(mockLicensesService.remove).not.toHaveBeenCalled();
    });
  });
});
