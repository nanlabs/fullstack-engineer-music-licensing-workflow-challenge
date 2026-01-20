import { Test, TestingModule } from '@nestjs/testing';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

describe('MovieController (Microservice)', () => {
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
    createMovie: jest.fn(),
    findAllMovies: jest.fn(),
    findMovieById: jest.fn(),
    findMovieSceneById: jest.fn(),
    findAllMovieScenes: jest.fn(),
    createMovieScene: jest.fn(),
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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOne', () => {
    it('should create and return a new movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'The Matrix',
        releaseDate: 1999,
        encodingFormat: 'Blu-ray',
      };
      mockMovieService.createMovie.mockResolvedValue(mockMovie);

      const result = await controller.createOne(createMovieDto);

      expect(result).toEqual(mockMovie);
      expect(mockMovieService.createMovie).toHaveBeenCalledWith(createMovieDto);
      expect(mockMovieService.createMovie).toHaveBeenCalledTimes(1);
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
        mockMovieService.createMovie.mockResolvedValue(expectedMovie);

        const result = await controller.createOne(createMovieDto);

        expect(result.encodingFormat).toBe(format);
      }
    });
  });

  describe('fetchAllMovies', () => {
    it('should return an array of movies', async () => {
      const movies = [mockMovie, { ...mockMovie, id: 2, title: 'The Matrix Reloaded' }];
      mockMovieService.findAllMovies.mockResolvedValue(movies);

      const result = await controller.fetchAllMovies();

      expect(result).toEqual(movies);
      expect(result).toHaveLength(2);
      expect(mockMovieService.findAllMovies).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no movies exist', async () => {
      mockMovieService.findAllMovies.mockResolvedValue([]);

      const result = await controller.fetchAllMovies();

      expect(result).toEqual([]);
      expect(mockMovieService.findAllMovies).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchMovieById', () => {
    it('should return a movie by id', async () => {
      mockMovieService.findMovieById.mockResolvedValue(mockMovie);

      const result = await controller.fetchMovieById({ id: 1 });

      expect(result).toEqual(mockMovie);
      expect(mockMovieService.findMovieById).toHaveBeenCalledWith(1);
    });

    it('should return null when movie not found', async () => {
      mockMovieService.findMovieById.mockResolvedValue(null);

      const result = await controller.fetchMovieById({ id: 999 });

      expect(result).toBeNull();
      expect(mockMovieService.findMovieById).toHaveBeenCalledWith(999);
    });
  });

  describe('fetchMovieSceneById', () => {
    it('should return a movie scene by id', async () => {
      mockMovieService.findMovieSceneById.mockResolvedValue(mockMovieScene);

      const result = await controller.fetchMovieSceneById({ id: 1 });

      expect(result).toEqual(mockMovieScene);
      expect(mockMovieService.findMovieSceneById).toHaveBeenCalledWith(1);
    });

    it('should return null when scene not found', async () => {
      mockMovieService.findMovieSceneById.mockResolvedValue(null);

      const result = await controller.fetchMovieSceneById({ id: 999 });

      expect(result).toBeNull();
      expect(mockMovieService.findMovieSceneById).toHaveBeenCalledWith(999);
    });
  });

  describe('fetchAllMovieScenes', () => {
    it('should return an array of movie scenes', async () => {
      const scenes = [mockMovieScene, { ...mockMovieScene, id: 2, name: 'Lobby shootout' }];
      mockMovieService.findAllMovieScenes.mockResolvedValue(scenes);

      const result = await controller.fetchAllMovieScenes();

      expect(result).toEqual(scenes);
      expect(result).toHaveLength(2);
      expect(mockMovieService.findAllMovieScenes).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no scenes exist', async () => {
      mockMovieService.findAllMovieScenes.mockResolvedValue([]);

      const result = await controller.fetchAllMovieScenes();

      expect(result).toEqual([]);
    });
  });

  describe('createMovieScene', () => {
    it('should create and return a new movie scene', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
        name: 'Neo takes the red pill',
      };
      mockMovieService.createMovieScene.mockResolvedValue(mockMovieScene);

      const result = await controller.createMovieScene(createSceneDto);

      expect(result).toEqual(mockMovieScene);
      expect(mockMovieService.createMovieScene).toHaveBeenCalledWith(createSceneDto);
      expect(mockMovieService.createMovieScene).toHaveBeenCalledTimes(1);
    });

    it('should create scene with optional name as empty', async () => {
      const createSceneDto: CreateMovieSceneDto = {
        movieId: 1,
      };
      const sceneWithoutName = { ...mockMovieScene, name: '' };
      mockMovieService.createMovieScene.mockResolvedValue(sceneWithoutName);

      const result = await controller.createMovieScene(createSceneDto);

      expect(result.name).toBe('');
      expect(mockMovieService.createMovieScene).toHaveBeenCalledWith(createSceneDto);
    });
  });
});
