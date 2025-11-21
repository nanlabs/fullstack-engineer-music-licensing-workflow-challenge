/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { Movie } from '../../entities';
import { MoviesService } from './movies.service';
import { MoviesRepository } from './movies.repository';
import { CreateMovieDto, UpdateMovieDto } from './dto';

describe('MoviesService', () => {
  let service: MoviesService;
  let mockRepository: jest.Mocked<MoviesRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        {
          provide: MoviesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'Inception',
        description: 'A mind-bending thriller',
        releaseYear: 2010,
      };

      const mockMovie: Movie = {
        id: 'movie-1',
        ...createMovieDto,
        description: createMovieDto.description || '',
        scenes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockMovie);

      const result = await service.create(createMovieDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createMovieDto);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('findAll', () => {
    it('should return an array of movies', async () => {
      const mockMovies: Movie[] = [
        {
          id: 'movie-1',
          title: 'Inception',
          description: 'A mind-bending thriller',
          releaseYear: 2010,
          scenes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'movie-2',
          title: 'The Matrix',
          description: 'A computer hacker learns',
          releaseYear: 1999,
          scenes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.findAll.mockResolvedValue(mockMovies);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockMovies);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no movies exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a movie by id', async () => {
      const mockMovie: Movie = {
        id: 'movie-1',
        title: 'Inception',
        description: 'A mind-bending thriller',
        releaseYear: 2010,
        scenes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockMovie);

      const result = await service.findOne('movie-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('movie-1');
      expect(result).toEqual(mockMovie);
    });

    it('should return null when movie is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return the movie', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'Inception Updated',
        description: 'An updated description',
      };

      const mockUpdatedMovie: Movie = {
        id: 'movie-1',
        title: 'Inception Updated',
        description: 'An updated description',
        releaseYear: 2010,
        scenes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.update.mockResolvedValue(mockUpdatedMovie);

      const result = await service.update('movie-1', updateMovieDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        'movie-1',
        updateMovieDto,
      );
      expect(result).toEqual(mockUpdatedMovie);
    });

    it('should return null when movie to update is not found', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'Non-existent Movie',
      };

      mockRepository.update.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateMovieDto);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a movie by id', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('movie-1');

      expect(mockRepository.remove).toHaveBeenCalledWith('movie-1');
    });

    it('should handle deletion of non-existent movie', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('non-existent-id');

      expect(mockRepository.remove).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
