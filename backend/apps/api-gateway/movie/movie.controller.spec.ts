import { Test, TestingModule } from '@nestjs/testing';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

describe('MovieController (API Gateway)', () => {
  let controller: MovieController;
  let movieService: jest.Mocked<MovieService>;

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

  const mockMovieService = {
    getHealth: jest.fn(),
    fetch: jest.fn(),
    create: jest.fn(),
    fetchScenes: jest.fn(),
    createScene: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovieController],
      providers: [
        {
          provide: MovieService,
          useValue: mockMovieService,
        },
      ],
    }).compile();

    controller = module.get<MovieController>(MovieController);
    movieService = module.get(MovieService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const healthMessage = 'Hello World FROM API API Gateway!';
      mockMovieService.getHealth.mockReturnValue(healthMessage);

      const result = controller.getHealth();

      expect(result).toBe(healthMessage);
      expect(mockMovieService.getHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetch', () => {
    it('should return an array of movies', async () => {
      const movies = [mockMovie];
      mockMovieService.fetch.mockResolvedValue(movies);

      const result = await controller.fetch();

      expect(result).toEqual(movies);
      expect(mockMovieService.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no movies exist', async () => {
      mockMovieService.fetch.mockResolvedValue([]);

      const result = await controller.fetch();

      expect(result).toEqual([]);
      expect(mockMovieService.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should create and return a new movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'The Matrix',
        releaseDate: 1999,
        encodingFormat: 'Blu-ray',
      };
      mockMovieService.create.mockResolvedValue(mockMovie);

      const result = await controller.create(createMovieDto);

      expect(result).toEqual(mockMovie);
      expect(mockMovieService.create).toHaveBeenCalledWith(createMovieDto);
      expect(mockMovieService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchScenes', () => {
    it('should return an array of movie scenes', async () => {
      const scenes = [mockMovieScene];
      mockMovieService.fetchScenes.mockResolvedValue(scenes);

      const result = await controller.fetchScenes();

      expect(result).toEqual(scenes);
      expect(mockMovieService.fetchScenes).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no scenes exist', async () => {
      mockMovieService.fetchScenes.mockResolvedValue([]);

      const result = await controller.fetchScenes();

      expect(result).toEqual([]);
      expect(mockMovieService.fetchScenes).toHaveBeenCalledTimes(1);
    });
  });

  describe('createScene', () => {
    it('should create and return a new movie scene', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
        name: 'Neo takes the red pill',
      };
      mockMovieService.createScene.mockResolvedValue(mockMovieScene);

      const result = await controller.createScene(createSceneDto);

      expect(result).toEqual(mockMovieScene);
      expect(mockMovieService.createScene).toHaveBeenCalledWith(createSceneDto);
      expect(mockMovieService.createScene).toHaveBeenCalledTimes(1);
    });

    it('should create scene with optional name', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
      };
      const sceneWithoutName = { ...mockMovieScene, name: '' };
      mockMovieService.createScene.mockResolvedValue(sceneWithoutName);

      const result = await controller.createScene(createSceneDto);

      expect(result).toEqual(sceneWithoutName);
      expect(mockMovieService.createScene).toHaveBeenCalledWith(createSceneDto);
    });
  });
});
