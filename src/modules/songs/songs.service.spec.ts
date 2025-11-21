/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';
import { CreateSongDto, UpdateSongDto } from './dto';

describe('SongsService', () => {
  let service: SongsService;
  let mockRepository: jest.Mocked<SongsRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongsService,
        {
          provide: SongsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SongsService>(SongsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Time',
        artist: 'Hans Zimmer',
        durationSeconds: 276,
      };

      const mockSong = {
        id: 'song-1',
        ...createSongDto,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.create.mockResolvedValue(mockSong);

      const result = await service.create(createSongDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createSongDto);
      expect(result).toEqual(mockSong);
    });
  });

  describe('findAll', () => {
    it('should return an array of songs', async () => {
      const mockSongs = [
        {
          id: 'song-1',
          title: 'Time',
          artist: 'Hans Zimmer',
          durationSeconds: 276,
          tracks: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'song-2',
          title: 'Dream Is Collapsing',
          artist: 'Hans Zimmer',
          durationSeconds: 149,
          tracks: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any;

      mockRepository.findAll.mockResolvedValue(mockSongs);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockSongs);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no songs exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a song by id with tracks', async () => {
      const mockSong = {
        id: 'song-1',
        title: 'Time',
        artist: 'Hans Zimmer',
        durationSeconds: 276,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.findOne.mockResolvedValue(mockSong);

      const result = await service.findOne('song-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('song-1');
      expect(result).toEqual(mockSong);
    });

    it('should return null when song is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return the song', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'Time (Extended)',
        durationSeconds: 300,
      };

      const mockUpdatedSong = {
        id: 'song-1',
        title: 'Time (Extended)',
        artist: 'Hans Zimmer',
        durationSeconds: 300,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockRepository.update.mockResolvedValue(mockUpdatedSong);

      const result = await service.update('song-1', updateSongDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        'song-1',
        updateSongDto,
      );
      expect(result).toEqual(mockUpdatedSong);
    });

    it('should return null when song to update is not found', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'Non-existent Song',
      };

      mockRepository.update.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateSongDto);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete a song by id', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('song-1');

      expect(mockRepository.remove).toHaveBeenCalledWith('song-1');
    });

    it('should handle deletion of non-existent song', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('non-existent-id');

      expect(mockRepository.remove).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
