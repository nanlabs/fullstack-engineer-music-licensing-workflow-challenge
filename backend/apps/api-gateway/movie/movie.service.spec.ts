import { Test, TestingModule } from '@nestjs/testing';
import { MovieService } from './movie.service';
import { ClientRMQ } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

describe('MovieService (API Gateway)', () => {
  let service: MovieService;
  let movieClient: jest.Mocked<ClientRMQ>;

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

  const mockClientRMQ = {
    send: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        {
          provide: 'MOVIE_SERVICE',
          useValue: mockClientRMQ,
        },
      ],
    }).compile();

    service = module.get<MovieService>(MovieService);
    movieClient = module.get('MOVIE_SERVICE');

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health message', () => {
      const result = service.getHealth();
      expect(result).toBe('Hello World FROM API API Gateway!');
    });
  });

  describe('fetch', () => {
    it('should fetch all movies from microservice', async () => {
      const movies = [mockMovie];
      mockClientRMQ.send.mockReturnValue(of(movies));

      const result = await service.fetch();

      expect(result).toEqual(movies);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie.fetch.all', {});
    });

    it('should return empty array when no movies exist', async () => {
      mockClientRMQ.send.mockReturnValue(of([]));

      const result = await service.fetch();

      expect(result).toEqual([]);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie.fetch.all', {});
    });

    it('should propagate errors from microservice', async () => {
      const error = new Error('Microservice unavailable');
      mockClientRMQ.send.mockReturnValue(throwError(() => error));

      await expect(service.fetch()).rejects.toThrow('Microservice unavailable');
    });
  });

  describe('create', () => {
    it('should create a movie via microservice', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'The Matrix',
        releaseDate: 1999,
        encodingFormat: 'Blu-ray',
      };
      mockClientRMQ.send.mockReturnValue(of(mockMovie));

      const result = await service.create(createMovieDto);

      expect(result).toEqual(mockMovie);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie.create.one', createMovieDto);
    });

    it('should propagate validation errors from microservice', async () => {
      const createMovieDto: CreateMovieDto = {
        title: '',
        releaseDate: 1999,
        encodingFormat: 'Blu-ray',
      };
      const error = new Error('Validation failed');
      mockClientRMQ.send.mockReturnValue(throwError(() => error));

      await expect(service.create(createMovieDto)).rejects.toThrow('Validation failed');
    });
  });

  describe('fetchScenes', () => {
    it('should fetch all movie scenes from microservice', async () => {
      const scenes = [mockMovieScene];
      mockClientRMQ.send.mockReturnValue(of(scenes));

      const result = await service.fetchScenes();

      expect(result).toEqual(scenes);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie-scene.fetch.all', {});
    });

    it('should return empty array when no scenes exist', async () => {
      mockClientRMQ.send.mockReturnValue(of([]));

      const result = await service.fetchScenes();

      expect(result).toEqual([]);
    });
  });

  describe('createScene', () => {
    it('should create a movie scene via microservice', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
        name: 'Neo takes the red pill',
      };
      mockClientRMQ.send.mockReturnValue(of(mockMovieScene));

      const result = await service.createScene(createSceneDto);

      expect(result).toEqual(mockMovieScene);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie-scene.create.one', createSceneDto);
    });

    it('should handle scene creation without name', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
      };
      const sceneWithoutName = { ...mockMovieScene, name: '' };
      mockClientRMQ.send.mockReturnValue(of(sceneWithoutName));

      const result = await service.createScene(createSceneDto);

      expect(result).toEqual(sceneWithoutName);
      expect(mockClientRMQ.send).toHaveBeenCalledWith('movie-scene.create.one', createSceneDto);
    });

    it('should propagate errors when movie not found', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 999,
        name: 'Scene for non-existent movie',
      };
      const error = new Error('Movie not found');
      mockClientRMQ.send.mockReturnValue(throwError(() => error));

      await expect(service.createScene(createSceneDto)).rejects.toThrow('Movie not found');
    });
  });
});
