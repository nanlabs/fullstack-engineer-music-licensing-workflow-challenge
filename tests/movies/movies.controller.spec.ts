import { Test, TestingModule } from '@nestjs/testing';
import { MoviesController } from '../../src/movies/movies.controller';
import { MoviesService } from '../../src/movies/movies.service';
import { CreateMovieDto } from '../../src/movies/dto/create-movie.dto';

describe('MoviesController', () => {
  let controller: MoviesController;
  let service: MoviesService;

  const mockMovie = {
    id: '1',
    title: 'Test Movie',
    description: 'Test Description',
    director: 'Test Director',
    releaseYear: 2024,
    scenes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMoviesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [
        {
          provide: MoviesService,
          useValue: mockMoviesService,
        },
      ],
    }).compile();

    controller = module.get<MoviesController>(MoviesController);
    service = module.get<MoviesService>(MoviesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a movie', async () => {
      const createDto: CreateMovieDto = {
        title: 'Test Movie',
        description: 'Test Description',
        director: 'Test Director',
        releaseYear: 2024,
      };

      mockMoviesService.create.mockResolvedValue(mockMovie);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('findAll', () => {
    it('should return an array of movies', async () => {
      const paginationDto = { page: 1, limit: 10 };
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
      mockMoviesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(paginationDto);

      expect(service.findAll).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should return a movie by id', async () => {
      mockMoviesService.findOne.mockResolvedValue(mockMovie);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockMovie);
    });
  });

  describe('update', () => {
    it('should update a movie', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedMovie = { ...mockMovie, ...updateDto };

      mockMoviesService.update.mockResolvedValue(updatedMovie);

      const result = await controller.update('1', updateDto);

      expect(service.update).toHaveBeenCalledWith('1', updateDto);
      expect(result).toEqual(updatedMovie);
    });
  });

  describe('remove', () => {
    it('should delete a movie', async () => {
      mockMoviesService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
