import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { Movie } from '../../entities/movie.entity';
import { CreateMovieDto } from './dto/create-movie.dto';

describe('MoviesService', () => {
  let service: MoviesService;
  let movieRepository: Repository<Movie>;

  const mockMovieRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockMovie: Movie = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Movie',
    description: 'A test movie',
    director: 'Test Director',
    producer: 'Test Producer',
    releaseDate: new Date('2024-01-01'),
    status: 'development',
    scenes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
        },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
    movieRepository = module.get<Repository<Movie>>(getRepositoryToken(Movie));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'New Movie',
        description: 'A new movie',
        director: 'New Director',
        producer: 'New Producer',
        releaseDate: '2024-06-01',
        status: 'development',
      };

      mockMovieRepository.create.mockReturnValue(mockMovie);
      mockMovieRepository.save.mockResolvedValue(mockMovie);

      const result = await service.create(createMovieDto);

      expect(mockMovieRepository.create).toHaveBeenCalledWith(createMovieDto);
      expect(mockMovieRepository.save).toHaveBeenCalledWith(mockMovie);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('findAll', () => {
    it('should return all movies with scenes', async () => {
      const moviesWithScenes = [{ ...mockMovie, scenes: [] }];
      mockMovieRepository.find.mockResolvedValue(moviesWithScenes);

      const result = await service.findAll();

      expect(mockMovieRepository.find).toHaveBeenCalledWith({
        relations: ['scenes'],
      });
      expect(result).toEqual(moviesWithScenes);
    });
  });

  describe('findOne', () => {
    it('should return a movie with deep relations when found', async () => {
      const movieWithRelations = {
        ...mockMovie,
        scenes: [{
          id: '1',
          tracks: [{
            id: '1',
            song: { id: '1', title: 'Test Song' },
            license: { id: '1', status: 'pending' },
          }],
        }],
      };

      mockMovieRepository.findOne.mockResolvedValue(movieWithRelations);

      const result = await service.findOne(mockMovie.id);

      expect(mockMovieRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockMovie.id },
        relations: [
          'scenes',
          'scenes.tracks',
          'scenes.tracks.song',
          'scenes.tracks.license',
        ],
      });
      expect(result).toEqual(movieWithRelations);
    });

    it('should throw NotFoundException when movie not found', async () => {
      mockMovieRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);

      expect(mockMovieRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        relations: [
          'scenes',
          'scenes.tracks',
          'scenes.tracks.song',
          'scenes.tracks.license',
        ],
      });
    });
  });

  describe('remove', () => {
    it('should successfully remove a movie', async () => {
      mockMovieRepository.findOne.mockResolvedValue(mockMovie);
      mockMovieRepository.remove.mockResolvedValue(mockMovie);

      await service.remove(mockMovie.id);

      expect(mockMovieRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockMovie.id },
        relations: [
          'scenes',
          'scenes.tracks',
          'scenes.tracks.song',
          'scenes.tracks.license',
        ],
      });
      expect(mockMovieRepository.remove).toHaveBeenCalledWith(mockMovie);
    });

    it('should throw NotFoundException when trying to remove non-existent movie', async () => {
      mockMovieRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);

      expect(mockMovieRepository.remove).not.toHaveBeenCalled();
    });
  });
});