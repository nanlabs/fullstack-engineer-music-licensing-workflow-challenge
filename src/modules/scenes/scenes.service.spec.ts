import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScenesService } from './scenes.service';
import { Scene } from './entities/scene.entity';
import { Movie } from '../movies/entities/movie.entity';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { FindAllSceneDto } from './dto/findAll-scene.dto';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';

describe('ScenesService', () => {
  let service: ScenesService;

  const mockSceneRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
  };

  const mockMovieRepository = {
    findOneBy: jest.fn(),
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
        ScenesService,
        {
          provide: getRepositoryToken(Scene),
          useValue: mockSceneRepository,
        },
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
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

    service = module.get<ScenesService>(ScenesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(null);
  });

  describe('create', () => {
    it('should create a new scene', async () => {
      const createSceneDto: CreateSceneDto = {
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
      };

      const mockMovie = {
        id: 1,
        title: 'Test Movie',
        description: 'Movie Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockScene = {
        id: 1,
        ...createSceneDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMovieRepository.findOneBy.mockResolvedValue(mockMovie);
      mockSceneRepository.create.mockReturnValue(mockScene);
      mockSceneRepository.save.mockResolvedValue(mockScene);

      const result = await service.create(createSceneDto);

      expect(mockMovieRepository.findOneBy).toHaveBeenCalledWith({
        id: createSceneDto.movie_id,
        is_deleted: false,
      });
      expect(mockSceneRepository.create).toHaveBeenCalledWith({
        movie_id: createSceneDto.movie_id,
        title: createSceneDto.title,
        description: createSceneDto.description,
      });
      expect(mockSceneRepository.save).toHaveBeenCalledWith(mockScene);
      expect(result).toEqual(mockScene);
    });

    it('should throw I18nException when movie is not found', async () => {
      const createSceneDto: CreateSceneDto = {
        movie_id: 999,
        title: 'Test Scene',
        description: 'Test Description',
      };

      mockMovieRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.create(createSceneDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockMovieRepository.findOneBy).toHaveBeenCalledWith({
        id: createSceneDto.movie_id,
        is_deleted: false,
      });
      expect(mockSceneRepository.create).not.toHaveBeenCalled();
      expect(mockSceneRepository.save).not.toHaveBeenCalled();
    });

    it('should throw I18nException when movie is deleted', async () => {
      const createSceneDto: CreateSceneDto = {
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
      };

      mockMovieRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.create(createSceneDto)).rejects.toThrow(
        I18nException,
      );
    });
  });

  describe('findAllByMovie', () => {
    it('should return paginated scenes for a movie', async () => {
      const movie_id = 1;
      const findAllSceneDto: FindAllSceneDto = {
        page: 1,
        limit: 10,
      };

      const mockScenes = [
        {
          id: 1,
          movie_id: 1,
          title: 'Scene 1',
          description: 'Description 1',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          movie_id: 1,
          title: 'Scene 2',
          description: 'Description 2',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockSceneRepository.findAndCount.mockResolvedValue([mockScenes, 2]);

      const result = await service.findAllByMovie(movie_id, findAllSceneDto);

      expect(mockSceneRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { movie_id, is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).data).toEqual(mockScenes);
      expect((result as any).pagination).toBeDefined();
      expect((result as any).pagination.totalPages).toBe(1);
      expect((result as any).pagination.pageSize).toBe(10);
    });

    it('should handle pagination correctly', async () => {
      const movie_id = 1;
      const findAllSceneDto: FindAllSceneDto = {
        page: 2,
        limit: 5,
      };

      const mockScenes = [];
      mockSceneRepository.findAndCount.mockResolvedValue([mockScenes, 0]);

      const result = await service.findAllByMovie(movie_id, findAllSceneDto);

      expect(mockSceneRepository.findAndCount).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        where: { movie_id, is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect((result as any).pagination.pageSize).toBe(5);
    });

    it('should use default pagination values when not provided', async () => {
      const movie_id = 1;
      const findAllSceneDto: FindAllSceneDto = {};

      const mockScenes = [];
      mockSceneRepository.findAndCount.mockResolvedValue([mockScenes, 0]);

      await service.findAllByMovie(movie_id, findAllSceneDto);

      expect(mockSceneRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { movie_id, is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a scene by id', async () => {
      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSceneRepository.findOneBy.mockResolvedValue(mockScene);

      const result = await service.findOne(1);

      expect(mockSceneRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
        is_deleted: false,
      });
      expect(result).toEqual(mockScene);
    });

    it('should throw I18nException when scene is not found', async () => {
      mockSceneRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.findOne(999)).rejects.toThrow(I18nException);
      expect(mockSceneRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
        is_deleted: false,
      });
    });

    it('should throw I18nException when scene is deleted', async () => {
      mockSceneRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.findOne(1)).rejects.toThrow(I18nException);
    });
  });

  describe('update', () => {
    it('should update a scene', async () => {
      const updateSceneDto: UpdateSceneDto = {
        title: 'Updated Title',
      };

      const existingScene = {
        id: 1,
        movie_id: 1,
        title: 'Original Title',
        description: 'Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedScene = {
        ...existingScene,
        ...updateSceneDto,
      };

      mockSceneRepository.findOne.mockResolvedValueOnce(existingScene);
      mockSceneRepository.findOneBy.mockResolvedValueOnce(updatedScene);
      mockSceneRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateSceneDto);

      expect(mockSceneRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
      });
      expect(mockSceneRepository.update).toHaveBeenCalledWith(
        1,
        updateSceneDto,
      );
      expect(result).toEqual(updatedScene);
    });

    it('should throw I18nException when scene is not found', async () => {
      const updateSceneDto: UpdateSceneDto = {
        title: 'Updated Title',
      };

      mockSceneRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.update(999, updateSceneDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockSceneRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
      });
      expect(mockSceneRepository.update).not.toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const updateSceneDto: UpdateSceneDto = {
        title: 'New Title',
        description: 'New Description',
      };

      const existingScene = {
        id: 1,
        movie_id: 1,
        title: 'Original Title',
        description: 'Original Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedScene = {
        ...existingScene,
        ...updateSceneDto,
      };

      mockSceneRepository.findOne.mockResolvedValueOnce(existingScene);
      mockSceneRepository.findOneBy.mockResolvedValueOnce(updatedScene);
      mockSceneRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateSceneDto);

      expect(mockSceneRepository.update).toHaveBeenCalledWith(
        1,
        updateSceneDto,
      );
      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Description');
    });
  });

  describe('remove', () => {
    it('should soft delete a scene', async () => {
      const mockScene = {
        id: 1,
        movie_id: 1,
        title: 'Test Scene',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const deletedScene = {
        ...mockScene,
        is_deleted: true,
      };

      mockSceneRepository.findOne.mockResolvedValue(mockScene);
      mockSceneRepository.save.mockResolvedValue(deletedScene);

      const result = await service.remove(1);

      expect(mockSceneRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
      });
      expect(mockSceneRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: true }),
      );
      expect(result.is_deleted).toBe(true);
    });

    it('should throw I18nException when scene is not found', async () => {
      mockSceneRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.remove(999)).rejects.toThrow(I18nException);
      expect(mockSceneRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
      });
      expect(mockSceneRepository.save).not.toHaveBeenCalled();
    });

    it('should throw I18nException when scene is already deleted', async () => {
      mockSceneRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Scene not found');

      await expect(service.remove(1)).rejects.toThrow(I18nException);
    });
  });
});
