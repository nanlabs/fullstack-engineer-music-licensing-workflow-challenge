/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { ScenesService } from './scenes.service';
import { ScenesRepository } from './scenes.repository';

describe('ScenesService', () => {
  let service: ScenesService;
  let mockRepository: jest.Mocked<ScenesRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByMovieId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenesService,
        {
          provide: ScenesRepository,
          useValue: mockRepository,
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

      const mockScene = {
        id: 'scene-1',
        ...createSceneDto,
      } as any;

      mockRepository.create.mockResolvedValue(mockScene);

      const result = await service.create(createSceneDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createSceneDto);
      expect(result).toEqual(mockScene);
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

    it('should return null when scene is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
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

    it('should return null when scene to update is not found', async () => {
      const updateSceneDto = { name: 'Updated Scene' };

      mockRepository.update.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateSceneDto);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a scene', async () => {
      const sceneId = 'scene-1';

      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(sceneId);

      expect(mockRepository.remove).toHaveBeenCalledWith(sceneId);
    });
  });
});
