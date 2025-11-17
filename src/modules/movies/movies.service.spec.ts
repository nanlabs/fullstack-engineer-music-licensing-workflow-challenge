import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike } from 'typeorm';
import { MoviesService } from './movies.service';
import { Movie } from './entities/movie.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { FindAllMoviesDto } from './dto/findAll-movies.dto';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';

describe('MoviesService', () => {
  let service: MoviesService;

  const mockRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
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
        MoviesService,
        {
          provide: getRepositoryToken(Movie),
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

    service = module.get<MoviesService>(MoviesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(null);
  });

  describe('create', () => {
    it('should create a new movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'Test Movie',
        description: 'Test Description',
      };

      const mockMovie = {
        id: 1,
        ...createMovieDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.save.mockResolvedValue(mockMovie);

      const result = await service.create(createMovieDto);

      expect(mockRepository.save).toHaveBeenCalledWith(createMovieDto);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('findAll', () => {
    it('should return paginated movies without filters', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
      };

      const mockMovies = [
        {
          id: 1,
          title: 'Movie 1',
          description: 'Description 1',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          title: 'Movie 2',
          description: 'Description 2',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockMovies, 2]);

      const result = await service.findAll(findAllMoviesDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect((result as any).data).toEqual(mockMovies);
      expect((result as any).pagination).toBeDefined();
      expect((result as any).pagination.totalPages).toBe(1);
      expect((result as any).pagination.pageSize).toBe(10);
    });

    it('should return paginated movies with search filter', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
        search: 'Test',
      };

      const mockMovies = [
        {
          id: 1,
          title: 'Test Movie',
          description: 'Description',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockMovies, 1]);

      const result = await service.findAll(findAllMoviesDto);

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
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect((result as any).data).toEqual(mockMovies);
      expect((result as any).pagination.totalPages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 2,
        limit: 5,
      };

      const mockMovies = [];
      mockRepository.findAndCount.mockResolvedValue([mockMovies, 0]);

      const result = await service.findAll(findAllMoviesDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
      expect(result).toHaveProperty('pagination');
      expect((result as any).pagination.pageSize).toBe(5);
    });

    it('should use default pagination values when not provided', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
      };

      const mockMovies = [];
      mockRepository.findAndCount.mockResolvedValue([mockMovies, 0]);

      await service.findAll(findAllMoviesDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { is_deleted: false },
        order: {
          created_at: 'DESC',
        },
      });
    });

    it('should order movies by created_at DESC', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
      };

      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(findAllMoviesDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: {
            created_at: 'DESC',
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a movie by id', async () => {
      const mockMovie = {
        id: 1,
        title: 'Test Movie',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockMovie);

      const result = await service.findOne(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
      });
      expect(result).toEqual(mockMovie);
    });

    it('should throw I18nException when movie is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.findOne(999)).rejects.toThrow(I18nException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
      });
    });

    it('should throw I18nException when movie is deleted', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.findOne(1)).rejects.toThrow(I18nException);
    });
  });

  describe('update', () => {
    it('should update a movie', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'Updated Title',
      };

      const existingMovie = {
        id: 1,
        title: 'Original Title',
        description: 'Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedMovie = {
        ...existingMovie,
        ...updateMovieDto,
      };

      mockRepository.findOne
        .mockResolvedValueOnce(existingMovie)
        .mockResolvedValueOnce(updatedMovie);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateMovieDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
      });
      expect(mockRepository.update).toHaveBeenCalledWith(1, updateMovieDto);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(updatedMovie);
    });

    it('should throw I18nException when movie is not found', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'Updated Title',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.update(999, updateMovieDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
      });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'New Title',
        description: 'New Description',
      };

      const existingMovie = {
        id: 1,
        title: 'Original Title',
        description: 'Original Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedMovie = {
        ...existingMovie,
        ...updateMovieDto,
      };

      mockRepository.findOne
        .mockResolvedValueOnce(existingMovie)
        .mockResolvedValueOnce(updatedMovie);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, updateMovieDto);

      expect(mockRepository.update).toHaveBeenCalledWith(1, updateMovieDto);
      expect(result).toEqual(updatedMovie);
      expect(result?.title).toBe('New Title');
      expect(result?.description).toBe('New Description');
    });
  });

  describe('remove', () => {
    it('should soft delete a movie', async () => {
      const mockMovie = {
        id: 1,
        title: 'Test Movie',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const deletedMovie = {
        ...mockMovie,
        is_deleted: true,
      };

      mockRepository.findOne.mockResolvedValue(mockMovie);
      mockRepository.save.mockResolvedValue(deletedMovie);

      const result = await service.remove(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, is_deleted: false },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: true }),
      );
      expect(result.is_deleted).toBe(true);
    });

    it('should throw I18nException when movie is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.remove(999)).rejects.toThrow(I18nException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999, is_deleted: false },
      });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw I18nException when movie is already deleted', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Movie not found');

      await expect(service.remove(1)).rejects.toThrow(I18nException);
    });
  });
});
