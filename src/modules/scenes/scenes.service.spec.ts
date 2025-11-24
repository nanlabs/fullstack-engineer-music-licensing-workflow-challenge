/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { ScenesService } from './scenes.service';
import { ScenesRepository } from './scenes.repository';
import {
  ResourceNotFoundException,
  DuplicateResourceException,
} from '../../common/exceptions';
import { MoviesRepository } from '../movies/movies.repository';

describe('ScenesService', () => {
  let service: ScenesService;
  let mockRepository: jest.Mocked<ScenesRepository>;
  let mockMoviesRepository: jest.Mocked<MoviesRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByMovieId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockMoviesRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenesService,
        {
          provide: ScenesRepository,
          useValue: mockRepository,
        },
        {
          provide: MoviesRepository,
          useValue: mockMoviesRepository,
        },
      ],
    }).compile();

    service = module.get<ScenesService>(ScenesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a scene', async () => {
      const createSceneDto = {
        name: 'Dream Within Dream',
        description: 'Key action scene',
        sceneNumber: 5,
        movieId: 'movie-1',
      };

      const mockMovie = {
        id: 'movie-1',
        title: 'Inception',
      } as any;

      const mockScene = {
        id: 'scene-1',
        ...createSceneDto,
      } as any;

      mockMoviesRepository.findOne.mockResolvedValue(mockMovie);
      mockRepository.findByMovieId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockScene);

      const result = await service.create(createSceneDto);

      expect(mockMoviesRepository.findOne).toHaveBeenCalledWith('movie-1');
      expect(mockRepository.findByMovieId).toHaveBeenCalledWith('movie-1');
      expect(mockRepository.create).toHaveBeenCalledWith(createSceneDto);
      expect(result).toEqual(mockScene);
    });

    it('should throw ResourceNotFoundException when movie does not exist', async () => {
      const createSceneDto = {
        name: 'Dream Within Dream',
        description: 'Key action scene',
        sceneNumber: 5,
        movieId: 'non-existent-movie',
      };

      mockMoviesRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createSceneDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should throw DuplicateResourceException when sceneNumber already exists for movie', async () => {
      const createSceneDto = {
        name: 'Dream Within Dream',
        description: 'Key action scene',
        sceneNumber: 5,
        movieId: 'movie-1',
      };

      const mockMovie = {
        id: 'movie-1',
        title: 'Inception',
      } as any;

      const existingScene = {
        id: 'scene-1',
        name: 'Existing Scene',
        sceneNumber: 5,
        movieId: 'movie-1',
      } as any;

      mockMoviesRepository.findOne.mockResolvedValue(mockMovie);
      mockRepository.findByMovieId.mockResolvedValue([existingScene]);

      await expect(service.create(createSceneDto)).rejects.toThrow(
        DuplicateResourceException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all scenes with relations', async () => {
      const mockScenes = [
        { id: 'scene-1', name: 'Scene 1', sceneNumber: 1 },
        { id: 'scene-2', name: 'Scene 2', sceneNumber: 2 },
      ] as any;

      mockRepository.findAll.mockResolvedValue(mockScenes);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockScenes);
    });

    it('should return an empty array when no scenes exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a single scene by id', async () => {
      const sceneId = 'scene-1';
      const mockScene = {
        id: sceneId,
        name: 'Dream Within Dream',
        sceneNumber: 5,
      } as any;

      mockRepository.findOne.mockResolvedValue(mockScene);

      const result = await service.findOne(sceneId);

      expect(mockRepository.findOne).toHaveBeenCalledWith(sceneId);
      expect(result).toEqual(mockScene);
    });

    it('should throw ResourceNotFoundException when scene is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('findByMovieId', () => {
    it('should return scenes filtered by movieId', async () => {
      const movieId = 'movie-1';
      const mockScenes = [
        { id: 'scene-1', name: 'Scene 1', movieId },
        { id: 'scene-2', name: 'Scene 2', movieId },
      ] as any;

      mockRepository.findByMovieId.mockResolvedValue(mockScenes);

      const result = await service.findByMovieId(movieId);

      expect(mockRepository.findByMovieId).toHaveBeenCalledWith(movieId);
      expect(result).toEqual(mockScenes);
    });

    it('should return empty array when no scenes found for movie', async () => {
      mockRepository.findByMovieId.mockResolvedValue([]);

      const result = await service.findByMovieId('non-existent-movie');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update and return the scene', async () => {
      const sceneId = 'scene-1';
      const updateSceneDto = { name: 'Updated Scene' };
      const mockScene = {
        id: sceneId,
        name: 'Updated Scene',
        sceneNumber: 5,
      } as any;

      mockRepository.update.mockResolvedValue(mockScene);

      const result = await service.update(sceneId, updateSceneDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        sceneId,
        updateSceneDto,
      );
      expect(result).toEqual(mockScene);
    });

    it('should throw ResourceNotFoundException when scene to update is not found', async () => {
      const updateSceneDto = { name: 'Updated Scene' };

      mockRepository.update.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateSceneDto),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a scene', async () => {
      const sceneId = 'scene-1';
      const mockScene = {
        id: sceneId,
        name: 'Dream Within Dream',
        sceneNumber: 5,
      } as any;

      mockRepository.findOne.mockResolvedValue(mockScene);
      mockRepository.remove.mockResolvedValue(undefined);

      const result = await service.remove(sceneId);

      expect(mockRepository.findOne).toHaveBeenCalledWith(sceneId);
      expect(mockRepository.remove).toHaveBeenCalledWith(sceneId);
      expect(result.message).toBe('Scene deleted successfully');
    });

    it('should throw ResourceNotFoundException when deleting non-existent scene', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});
