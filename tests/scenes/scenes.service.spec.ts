import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
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

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    isTransactionActive: true,
    manager: {
      save: jest.fn(),
      remove: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
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
        ScenesService,
        {
          provide: getRepositoryToken(Scene),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
      mockQueryRunner.manager.save.mockResolvedValue(mockScene);

      const result = await service.create(createDto);

      expect(mockMovieRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.movieId },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(Scene, mockScene);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
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
      mockQueryRunner.manager.save.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
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
      mockQueryRunner.manager.save.mockResolvedValue(updatedScene);

      const result = await service.update('1', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(result).toEqual(updatedScene);
    });

    it('should rollback transaction on error and rethrow NotFoundException', async () => {
      const updateDto = { title: 'Updated Title' };
      const notFoundError = new NotFoundException('Scene not found');

      mockRepository.findOne.mockRejectedValue(notFoundError);

      await expect(service.update('1', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error and rethrow BadRequestException', async () => {
      const updateDto = { title: 'Updated Title' };
      const badRequestError = new BadRequestException('Invalid data');

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.save.mockRejectedValue(badRequestError);

      await expect(service.update('1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on generic error and throw BadRequestException', async () => {
      const updateDto = { title: 'Updated Title' };
      const genericError = new Error('Database connection failed');

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.save.mockRejectedValue(genericError);

      await expect(service.update('1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should handle rollback when transaction is not active', async () => {
      const updateDto = { title: 'Updated Title' };
      const genericError = new Error('Database error');
      mockQueryRunner.isTransactionActive = false;

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.save.mockRejectedValue(genericError);

      await expect(service.update('1', updateDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const updateDto = { title: 'Updated Title' };
      const stringError = 'String error';
      mockQueryRunner.isTransactionActive = true;

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.save.mockRejectedValue(stringError);

      await expect(service.update('1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a scene', async () => {
      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.remove.mockResolvedValue(mockScene);

      await service.remove('1');

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(Scene, mockScene);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error and rethrow NotFoundException', async () => {
      const notFoundError = new NotFoundException('Scene not found');
      mockQueryRunner.isTransactionActive = true;

      mockRepository.findOne.mockRejectedValue(notFoundError);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on generic error and throw BadRequestException', async () => {
      const genericError = new Error('Database connection failed');

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.remove.mockRejectedValue(genericError);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should handle rollback when transaction is not active', async () => {
      const genericError = new Error('Database error');
      mockQueryRunner.isTransactionActive = false;

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.remove.mockRejectedValue(genericError);

      await expect(service.remove('1')).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'String error';

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockQueryRunner.manager.remove.mockRejectedValue(stringError);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
