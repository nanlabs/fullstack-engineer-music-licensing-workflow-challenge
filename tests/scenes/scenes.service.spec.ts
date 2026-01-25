import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScenesService } from '../../src/scenes/scenes.service';
import { Scene } from '../../src/entities/scene.entity';
import { Movie } from '../../src/entities/movie.entity';
import { CreateSceneDto } from '../../src/scenes/dto/create-scene.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ScenesService', () => {
  let service: ScenesService;

  const mockMovie = {
    id: 'movie-1',
    title: 'Test Movie',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScene: Scene = {
    id: '1',
    movieId: 'movie-1',
    movie: mockMovie as any,
    title: 'Test Scene',
    description: 'Test Description',
    sceneNumber: 1,
    startTime: 0,
    endTime: 180,
    tracks: [],
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

  const mockMovieRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenesService,
        {
          provide: getRepositoryToken(Scene),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
        },
      ],
    }).compile();

    service = module.get<ScenesService>(ScenesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a scene', async () => {
      const createDto: CreateSceneDto = {
        movieId: 'movie-1',
        title: 'Test Scene',
        description: 'Test Description',
        sceneNumber: 1,
        startTime: 0,
        endTime: 180,
      };

      mockMovieRepository.findOne.mockResolvedValue({ id: 'movie-1' });
      mockRepository.create.mockReturnValue(mockScene);
      mockRepository.save.mockResolvedValue(mockScene);

      const result = await service.create(createDto);

      expect(mockMovieRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.movieId },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockScene);
      expect(result).toEqual(mockScene);
    });

    it('should throw BadRequestException if movie not found', async () => {
      const createDto: CreateSceneDto = {
        movieId: 'movie-1',
        title: 'Test Scene',
      };

      mockMovieRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if endTime <= startTime', async () => {
      const createDto: CreateSceneDto = {
        movieId: 'movie-1',
        title: 'Test Scene',
        startTime: 100,
        endTime: 50,
      };

      mockMovieRepository.findOne.mockResolvedValue({ id: 'movie-1' });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle errors when creating scene', async () => {
      const createDto: CreateSceneDto = {
        movieId: 'movie-1',
        title: 'Test Scene',
      };

      mockMovieRepository.findOne.mockResolvedValue({ id: 'movie-1' });
      const error = new Error('Database error');
      mockRepository.create.mockReturnValue(mockScene);
      mockRepository.save.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated result of scenes', async () => {
      const paginatedResult = {
        data: [mockScene],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockRepository.findAndCount.mockResolvedValue([[mockScene], 1]);

      const result = await service.findAll(1, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findByMovie', () => {
    it('should return scenes for a specific movie', async () => {
      mockRepository.find.mockResolvedValue([mockScene]);

      const result = await service.findByMovie('movie-1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { movieId: 'movie-1' },
        relations: ['tracks', 'tracks.song', 'tracks.licensingStatusHistory'],
        order: { sceneNumber: 'ASC' },
      });
      expect(result).toEqual([mockScene]);
    });
  });

  describe('findOne', () => {
    it('should return a scene by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockScene);

      const result = await service.findOne('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: [
          'movie',
          'tracks',
          'tracks.song',
          'tracks.licensingStatusHistory',
        ],
      });
      expect(result).toEqual(mockScene);
    });

    it('should throw NotFoundException if scene not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a scene', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedScene = { ...mockScene, ...updateDto };

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockRepository.save.mockResolvedValue(updatedScene);

      const result = await service.update('1', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedScene);
    });
  });

  describe('remove', () => {
    it('should delete a scene', async () => {
      mockRepository.findOne.mockResolvedValue(mockScene);
      mockRepository.remove.mockResolvedValue(mockScene);

      await service.remove('1');

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.remove).toHaveBeenCalledWith(mockScene);
    });
  });
});
