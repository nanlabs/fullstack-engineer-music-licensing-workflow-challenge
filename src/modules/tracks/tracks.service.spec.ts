/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TracksService } from './tracks.service';
import { TracksRepository } from './tracks.repository';
import { CreateTrackDto, UpdateTrackDto } from './dto';

describe('TracksService', () => {
  let service: TracksService;
  let mockRepository: jest.Mocked<TracksRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findBySceneId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: TracksRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a track', async () => {
      const createTrackDto: CreateTrackDto = {
        name: 'Main Theme',
        sceneId: 'scene-1',
        songId: 'song-1',
        startTimeSeconds: 0,
        endTimeSeconds: 120,
      };

      const mockTrack = {
        id: 'track-1',
        ...createTrackDto,
        scene: null,
        song: null,
        license: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.create.mockResolvedValue(mockTrack);

      const result = await service.create(createTrackDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createTrackDto);
      expect(result).toEqual(mockTrack);
    });
  });

  describe('findAll', () => {
    it('should return an array of tracks with relations', async () => {
      const mockTracks = [
        {
          id: 'track-1',
          name: 'Main Theme',
          sceneId: 'scene-1',
          songId: 'song-1',
          startTimeSeconds: 0,
          endTimeSeconds: 120,
          scene: null,
          song: null,
          license: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'track-2',
          name: 'Background Music',
          sceneId: 'scene-2',
          songId: 'song-2',
          startTimeSeconds: 30,
          endTimeSeconds: 90,
          scene: null,
          song: null,
          license: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any;

      mockRepository.findAll.mockResolvedValue(mockTracks);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockTracks);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no tracks exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findBySceneId', () => {
    it('should return tracks for a specific scene', async () => {
      const mockTracks = [
        {
          id: 'track-1',
          name: 'Main Theme',
          sceneId: 'scene-1',
          songId: 'song-1',
          startTimeSeconds: 0,
          endTimeSeconds: 120,
          scene: null,
          song: null,
          license: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any;

      mockRepository.findBySceneId.mockResolvedValue(mockTracks);

      const result = await service.findBySceneId('scene-1');

      expect(mockRepository.findBySceneId).toHaveBeenCalledWith('scene-1');
      expect(result).toEqual(mockTracks);
    });

    it('should return empty array when no tracks found for scene', async () => {
      mockRepository.findBySceneId.mockResolvedValue([]);

      const result = await service.findBySceneId('non-existent-scene');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a track by id with relations', async () => {
      const mockTrack = {
        id: 'track-1',
        name: 'Main Theme',
        sceneId: 'scene-1',
        songId: 'song-1',
        startTimeSeconds: 0,
        endTimeSeconds: 120,
        scene: null,
        song: null,
        license: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.findOne.mockResolvedValue(mockTrack);

      const result = await service.findOne('track-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('track-1');
      expect(result).toEqual(mockTrack);
    });

    it('should return null when track is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return the track', async () => {
      const updateTrackDto: UpdateTrackDto = {
        name: 'Updated Theme',
        startTimeSeconds: 10,
        endTimeSeconds: 130,
      };

      const mockUpdatedTrack = {
        id: 'track-1',
        name: 'Updated Theme',
        sceneId: 'scene-1',
        songId: 'song-1',
        startTimeSeconds: 10,
        endTimeSeconds: 130,
        scene: null,
        song: null,
        license: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.update.mockResolvedValue(mockUpdatedTrack);

      const result = await service.update('track-1', updateTrackDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        'track-1',
        updateTrackDto,
      );
      expect(result).toEqual(mockUpdatedTrack);
    });

    it('should return null when track to update is not found', async () => {
      const updateTrackDto: UpdateTrackDto = {
        name: 'Non-existent Track',
      };

      mockRepository.update.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateTrackDto);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a track by id', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('track-1');

      expect(mockRepository.remove).toHaveBeenCalledWith('track-1');
    });

    it('should handle deletion of non-existent track', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('non-existent-id');

      expect(mockRepository.remove).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
