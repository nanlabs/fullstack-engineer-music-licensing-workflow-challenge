import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike } from 'typeorm';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { FindAllSongDto } from './dto/findAll-song.dto';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';

describe('SongsService', () => {
  let service: SongsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
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
        SongsService,
        {
          provide: getRepositoryToken(Song),
          useValue: mockRepository,
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

    service = module.get<SongsService>(SongsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(null);
  });

  describe('create', () => {
    it('should create a new song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
      };

      const mockSong = {
        id: 1,
        ...createSongDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.create.mockReturnValue(mockSong);
      mockRepository.save.mockResolvedValue(mockSong);

      const result = await service.create(createSongDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: createSongDto.title,
        artist: createSongDto.artist,
        genre: createSongDto.genre,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockSong);
      expect(result).toEqual(mockSong);
    });
  });

  describe('findAll', () => {
    it('should return paginated songs without filters', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
      };

      const mockSongs = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          genre: 'Pop',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          title: 'Song 2',
          artist: 'Artist 2',
          genre: 'Rock',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockSongs, 2]);

      const result = await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockSongs);
      expect((result as any).pagination).toBeDefined();
      expect((result as any).pagination.totalPages).toBe(1);
      expect((result as any).pagination.pageSize).toBe(10);
    });

    it('should return paginated songs with title filter', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
        title: 'Test',
      };

      const mockSongs = [
        {
          id: 1,
          title: 'Test Song',
          artist: 'Artist 1',
          genre: 'Pop',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockSongs, 1]);

      const result = await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          is_deleted: false,
          title: ILike('%Test%'),
        },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockSongs);
      expect((result as any).pagination.totalPages).toBe(1);
    });

    it('should return paginated songs with artist filter', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
        artist: 'Test Artist',
      };

      const mockSongs = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Test Artist',
          genre: 'Pop',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockSongs, 1]);

      const result = await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          is_deleted: false,
          artist: ILike('%Test Artist%'),
        },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockSongs);
      expect((result as any).pagination.totalPages).toBe(1);
    });

    it('should return paginated songs with both title and artist filters', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
        title: 'Test',
        artist: 'Artist',
      };

      const mockSongs = [
        {
          id: 1,
          title: 'Test Song',
          artist: 'Test Artist',
          genre: 'Pop',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockSongs, 1]);

      const result = await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {
          is_deleted: false,
          title: ILike('%Test%'),
          artist: ILike('%Artist%'),
        },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockSongs);
    });

    it('should handle pagination correctly', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 2,
        limit: 5,
      };

      const mockSongs = [];
      mockRepository.findAndCount.mockResolvedValue([mockSongs, 0]);

      const result = await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).pagination.pageSize).toBe(5);
    });

    it('should use default pagination values when not provided', async () => {
      const findAllSongDto: FindAllSongDto = {};

      const mockSongs = [];
      mockRepository.findAndCount.mockResolvedValue([mockSongs, 0]);

      await service.findAll(findAllSongDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a song by id', async () => {
      const mockSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findOneBy.mockResolvedValue(mockSong);

      const result = await service.findOne(1);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
        is_deleted: false,
      });
      expect(result).toEqual(mockSong);
    });

    it('should throw I18nException when song is not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.findOne(999)).rejects.toThrow(I18nException);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
        is_deleted: false,
      });
    });

    it('should throw I18nException when song is deleted', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.findOne(1)).rejects.toThrow(I18nException);
    });
  });

  describe('update', () => {
    it('should update a song', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'Updated Title',
      };

      const existingSong = {
        id: 1,
        title: 'Original Title',
        artist: 'Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedSong = {
        ...existingSong,
        ...updateSongDto,
        updated_at: new Date(),
      };

      mockRepository.findOneBy.mockResolvedValue(existingSong);
      mockRepository.save.mockResolvedValue(updatedSong);

      const result = await service.update(1, updateSongDto);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ ...existingSong, ...updateSongDto }),
      );
      expect(result).toEqual(updatedSong);
    });

    it('should throw I18nException when song is not found', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'Updated Title',
      };

      mockRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.update(999, updateSongDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 999 });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'New Title',
        artist: 'New Artist',
        genre: 'Rock',
      };

      const existingSong = {
        id: 1,
        title: 'Original Title',
        artist: 'Original Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedSong = {
        ...existingSong,
        ...updateSongDto,
      };

      mockRepository.findOneBy.mockResolvedValue(existingSong);
      mockRepository.save.mockResolvedValue(updatedSong);

      const result = await service.update(1, updateSongDto);

      expect(result).toEqual(updatedSong);
      expect(result.title).toBe('New Title');
      expect(result.artist).toBe('New Artist');
      expect(result.genre).toBe('Rock');
    });
  });

  describe('remove', () => {
    it('should soft delete a song', async () => {
      const mockSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const deletedSong = {
        ...mockSong,
        is_deleted: true,
      };

      mockRepository.findOneBy.mockResolvedValue(mockSong);
      mockRepository.save.mockResolvedValue(deletedSong);

      const result = await service.remove(1);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
        is_deleted: false,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: true }),
      );
      expect(result.is_deleted).toBe(true);
    });

    it('should throw I18nException when song is not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.remove(999)).rejects.toThrow(I18nException);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
        is_deleted: false,
      });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw I18nException when song is already deleted', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Song not found');

      await expect(service.remove(1)).rejects.toThrow(I18nException);
    });
  });
});
