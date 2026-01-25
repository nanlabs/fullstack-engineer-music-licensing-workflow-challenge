import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SongsService } from '../../src/songs/songs.service';
import { Song } from '../../src/entities/song.entity';
import { CreateSongDto } from '../../src/songs/dto/create-song.dto';
import { NotFoundException } from '@nestjs/common';

describe('SongsService', () => {
  let service: SongsService;

  const mockSong: Song = {
    id: '1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'Rock',
    duration: 180,
    rightsHolder: 'Test Records',
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
        SongsService,
        {
          provide: getRepositoryToken(Song),
          useValue: mockRepository,
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

    service = module.get<SongsService>(SongsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a song', async () => {
      const createDto: CreateSongDto = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        genre: 'Rock',
        duration: 180,
        rightsHolder: 'Test Records',
      };

      mockRepository.create.mockReturnValue(mockSong);
      mockQueryRunner.manager.save.mockResolvedValue(mockSong);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(Song, mockSong);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockSong);
    });

    it('should handle errors when creating song', async () => {
      const createDto: CreateSongDto = {
        title: 'Test Song',
        artist: 'Test Artist',
      };

      const error = new Error('Database error');
      mockRepository.create.mockReturnValue(mockSong);
      mockQueryRunner.manager.save.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return a paginated result of songs', async () => {
      const paginatedResult = {
        data: [mockSong],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockRepository.findAndCount.mockResolvedValue([[mockSong], 1]);

      const result = await service.findAll(1, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalled();
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should return a song by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockSong);

      const result = await service.findOne('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['tracks'],
      });
      expect(result).toEqual(mockSong);
    });

    it('should throw NotFoundException if song not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a song', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedSong = { ...mockSong, ...updateDto };

      mockRepository.findOne.mockResolvedValue(mockSong);
      mockQueryRunner.manager.save.mockResolvedValue(updatedSong);

      const result = await service.update('1', updateDto);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(result).toEqual(updatedSong);
    });
  });

  describe('remove', () => {
    it('should delete a song', async () => {
      mockRepository.findOne.mockResolvedValue(mockSong);
      mockQueryRunner.manager.remove.mockResolvedValue(mockSong);

      await service.remove('1');

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(Song, mockSong);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
