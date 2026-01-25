import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MoviesService } from '../../src/movies/movies.service';
import { Movie } from '../../src/entities/movie.entity';
import { CreateMovieDto } from '../../src/movies/dto/create-movie.dto';
import { NotFoundException } from '@nestjs/common';

describe('MoviesService', () => {
  let service: MoviesService;

  const mockMovie: Movie = {
    id: '1',
    title: 'Test Movie',
    description: 'Test Description',
    director: 'Test Director',
    releaseYear: 2024,
    scenes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
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
        MoviesService,
        {
          provide: getRepositoryToken(Movie),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a movie', async () => {
      const createDto: CreateMovieDto = {
        title: 'Test Movie',
        description: 'Test Description',
        director: 'Test Director',
        releaseYear: 2024,
      };

      mockRepository.create.mockReturnValue(mockMovie);
      mockRepository.save.mockResolvedValue(mockMovie);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockMovie);
      expect(result).toEqual(mockMovie);
    });

    it('should handle errors when creating movie', async () => {
      const createDto: CreateMovieDto = {
        title: 'Test Movie',
        description: 'Test Description',
        director: 'Test Director',
        releaseYear: 2024,
      };

      const error = new Error('Database error');
      mockRepository.create.mockReturnValue(mockMovie);
      mockRepository.save.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    it('should return a paginated result of movies', async () => {
      const paginatedResult = {
        data: [mockMovie],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockRepository.findAndCount.mockResolvedValue([[mockMovie], 1]);

      const result = await service.findAll(1, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should return a movie by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockMovie);

      const result = await service.findOne('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['scenes', 'scenes.tracks', 'scenes.tracks.song'],
      });
      expect(result).toEqual(mockMovie);
    });

    it('should throw NotFoundException if movie not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a movie', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedMovie = { ...mockMovie, ...updateDto };

      mockRepository.findOne.mockResolvedValue(mockMovie);
      mockRepository.save.mockResolvedValue(updatedMovie);

      const result = await service.update('1', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['scenes', 'scenes.tracks', 'scenes.tracks.song'],
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedMovie);
    });
  });

  describe('remove', () => {
    it('should delete a movie', async () => {
      mockRepository.findOne.mockResolvedValue(mockMovie);
      mockRepository.remove.mockResolvedValue(mockMovie);

      await service.remove('1');

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.remove).toHaveBeenCalledWith(mockMovie);
    });
  });
});
