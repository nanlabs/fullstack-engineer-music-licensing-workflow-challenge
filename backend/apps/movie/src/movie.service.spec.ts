import { Test, TestingModule } from '@nestjs/testing';
import { MovieService } from './movie.service';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { RpcException } from '@nestjs/microservices';
import { HttpStatus } from '@nestjs/common';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

describe('MovieService (Microservice)', () => {
  let service: MovieService;
  let typeOrmRepositoryService: jest.Mocked<TypeOrmRepositoryService>;

  const mockMovie = {
    id: 1,
    title: 'The Matrix',
    releaseDate: 1999,
    encodingFormat: 'Blu-ray',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMovieScene = {
    id: 1,
    name: 'Neo takes the red pill',
    movie: mockMovie,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMovieRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockMovieSceneRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockTypeOrmRepositoryService = {
    movieRepository: mockMovieRepository,
    movieSceneRepository: mockMovieSceneRepository,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        {
          provide: TypeOrmRepositoryService,
          useValue: mockTypeOrmRepositoryService,
        },
      ],
    }).compile();

    service = module.get<MovieService>(MovieService);
    typeOrmRepositoryService = module.get(TypeOrmRepositoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllMovies', () => {
    it('should return an array of movies', async () => {
      const movies = [mockMovie, { ...mockMovie, id: 2, title: 'The Matrix Reloaded' }];
      mockMovieRepository.findAll.mockResolvedValue(movies);

      const result = await service.findAllMovies();

      expect(result).toEqual(movies);
      expect(result).toHaveLength(2);
      expect(mockMovieRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no movies exist', async () => {
      mockMovieRepository.findAll.mockResolvedValue([]);

      const result = await service.findAllMovies();

      expect(result).toEqual([]);
      expect(mockMovieRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMovieById', () => {
    it('should return a movie by id', async () => {
      mockMovieRepository.findById.mockResolvedValue(mockMovie);

      const result = await service.findMovieById(1);

      expect(result).toEqual(mockMovie);
      expect(mockMovieRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when movie not found', async () => {
      mockMovieRepository.findById.mockResolvedValue(null);

      const result = await service.findMovieById(999);

      expect(result).toBeNull();
      expect(mockMovieRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('createMovie', () => {
    it('should create and return a new movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'The Matrix',
        releaseDate: 1999,
        encodingFormat: 'Blu-ray',
      };
      mockMovieRepository.createOne.mockResolvedValue(mockMovie);

      const result = await service.createMovie(createMovieDto);

      expect(result).toEqual(mockMovie);
      expect(mockMovieRepository.createOne).toHaveBeenCalledTimes(1);
      expect(mockMovieRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createMovieDto.title,
          releaseDate: createMovieDto.releaseDate,
          encodingFormat: createMovieDto.encodingFormat,
        }),
      );
    });

    it('should handle different encoding formats', async () => {
      const formats = ['DVD', 'Blu-ray', 'Digital', '4K UHD'];

      for (const format of formats) {
        const createMovieDto: CreateMovieDto = {
          title: 'Test Movie',
          releaseDate: 2023,
          encodingFormat: format,
        };
        const expectedMovie = { ...mockMovie, encodingFormat: format };
        mockMovieRepository.createOne.mockResolvedValue(expectedMovie);

        const result = await service.createMovie(createMovieDto);

        expect(result.encodingFormat).toBe(format);
      }
    });
  });

  describe('findAllMovieScenes', () => {
    it('should return an array of movie scenes with movie relation', async () => {
      const scenes = [mockMovieScene, { ...mockMovieScene, id: 2, name: 'Lobby shootout' }];
      mockMovieSceneRepository.findAll.mockResolvedValue(scenes);

      const result = await service.findAllMovieScenes();

      expect(result).toEqual(scenes);
      expect(result).toHaveLength(2);
      expect(mockMovieSceneRepository.findAll).toHaveBeenCalledWith(['movie']);
    });

    it('should return empty array when no scenes exist', async () => {
      mockMovieSceneRepository.findAll.mockResolvedValue([]);

      const result = await service.findAllMovieScenes();

      expect(result).toEqual([]);
      expect(mockMovieSceneRepository.findAll).toHaveBeenCalledWith(['movie']);
    });
  });

  describe('findMovieSceneById', () => {
    it('should return a movie scene by id', async () => {
      mockMovieSceneRepository.findById.mockResolvedValue(mockMovieScene);

      const result = await service.findMovieSceneById(1);

      expect(result).toEqual(mockMovieScene);
      expect(mockMovieSceneRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when scene not found', async () => {
      mockMovieSceneRepository.findById.mockResolvedValue(null);

      const result = await service.findMovieSceneById(999);

      expect(result).toBeNull();
      expect(mockMovieSceneRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('createMovieScene', () => {
    it('should create and return a new movie scene', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
        name: 'Neo takes the red pill',
      };
      mockMovieRepository.findById.mockResolvedValue(mockMovie);
      mockMovieSceneRepository.createOne.mockResolvedValue(mockMovieScene);

      const result = await service.createMovieScene(createSceneDto);

      expect(result).toEqual(mockMovieScene);
      expect(mockMovieRepository.findById).toHaveBeenCalledWith(1);
      expect(mockMovieSceneRepository.createOne).toHaveBeenCalledTimes(1);
      expect(mockMovieSceneRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createSceneDto.name,
          movie: mockMovie,
        }),
      );
    });

    it('should create scene with empty name when name is not provided', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
      };
      mockMovieRepository.findById.mockResolvedValue(mockMovie);
      const sceneWithEmptyName = { ...mockMovieScene, name: '' };
      mockMovieSceneRepository.createOne.mockResolvedValue(sceneWithEmptyName);

      const result = await service.createMovieScene(createSceneDto);

      expect(result.name).toBe('');
      expect(mockMovieSceneRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '',
          movie: mockMovie,
        }),
      );
    });

    it('should throw RpcException when movie not found', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 999,
        name: 'Scene for non-existent movie',
      };
      mockMovieRepository.findById.mockResolvedValue(null);

      await expect(service.createMovieScene(createSceneDto)).rejects.toThrow(RpcException);

      try {
        await service.createMovieScene(createSceneDto);
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect(error.getError()).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Movie with id 999 not found',
        });
      }

      expect(mockMovieRepository.findById).toHaveBeenCalledWith(999);
      expect(mockMovieSceneRepository.createOne).not.toHaveBeenCalled();
    });
  });
});
