/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { FindAllMoviesDto } from './dto/findAll-movies.dto';

describe('MoviesController', () => {
  let controller: MoviesController;
  let service: MoviesService;

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

      mockMoviesService.create.mockResolvedValue(mockMovie);

      const result = await controller.create(createMovieDto);

      expect(service.create).toHaveBeenCalledWith(createMovieDto);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('findAll', () => {
    it('should return paginated movies', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Movie 1',
            description: 'Description 1',
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockMoviesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(findAllMoviesDto);

      expect(service.findAll).toHaveBeenCalledWith(findAllMoviesDto);
      expect(result).toEqual(mockResponse);
    });

    it('should return movies with search filter', async () => {
      const findAllMoviesDto: FindAllMoviesDto = {
        page: 1,
        limit: 10,
        search: 'Test',
      };

      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockMoviesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(findAllMoviesDto);

      expect(service.findAll).toHaveBeenCalledWith(findAllMoviesDto);
      expect(result).toEqual(mockResponse);
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

      mockMoviesService.findOne.mockResolvedValue(mockMovie);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockMovie);
    });

    it('should convert string id to number', async () => {
      const mockMovie = {
        id: 123,
        title: 'Test Movie',
        description: 'Test Description',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMoviesService.findOne.mockResolvedValue(mockMovie);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockMovie);
    });
  });

  describe('update', () => {
    it('should update a movie', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'Updated Title',
      };

      const updateResult = {
        affected: 1,
      };

      mockMoviesService.update.mockResolvedValue(updateResult);

      const result = await controller.update('1', updateMovieDto);

      expect(service.update).toHaveBeenCalledWith(1, updateMovieDto);
      expect(result).toEqual(updateResult);
    });

    it('should convert string id to number', async () => {
      const updateMovieDto: UpdateMovieDto = {
        description: 'New Description',
      };

      const updateResult = {
        affected: 1,
      };

      mockMoviesService.update.mockResolvedValue(updateResult);

      const result = await controller.update('456', updateMovieDto);

      expect(service.update).toHaveBeenCalledWith(456, updateMovieDto);
      expect(result).toEqual(updateResult);
    });

    it('should update multiple fields', async () => {
      const updateMovieDto: UpdateMovieDto = {
        title: 'New Title',
        description: 'New Description',
      };

      const updateResult = {
        affected: 1,
      };

      mockMoviesService.update.mockResolvedValue(updateResult);

      const result = await controller.update('1', updateMovieDto);

      expect(service.update).toHaveBeenCalledWith(1, updateMovieDto);
      expect(result).toEqual(updateResult);
    });
  });

  describe('remove', () => {
    it('should remove a movie', async () => {
      const deletedMovie = {
        id: 1,
        title: 'Test Movie',
        description: 'Test Description',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMoviesService.remove.mockResolvedValue(deletedMovie);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(deletedMovie);
    });

    it('should convert string id to number', async () => {
      const deletedMovie = {
        id: 789,
        title: 'Test Movie',
        description: 'Test Description',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMoviesService.remove.mockResolvedValue(deletedMovie);

      const result = await controller.remove('789');

      expect(service.remove).toHaveBeenCalledWith(789);
      expect(result).toEqual(deletedMovie);
    });
  });
});
