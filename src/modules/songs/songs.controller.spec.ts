/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { FindAllSongDto } from './dto/findAll-song.dto';

describe('SongsController', () => {
  let controller: SongsController;
  let service: SongsService;

  const mockSongsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [
        {
          provide: SongsService,
          useValue: mockSongsService,
        },
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
    service = module.get<SongsService>(SongsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
      };

      const mockSong = {
        id: 1,
        ...createSongDto,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.create.mockResolvedValue(mockSong);

      const result = await controller.create(createSongDto);

      expect(service.create).toHaveBeenCalledWith(createSongDto);
      expect(result).toEqual(mockSong);
    });
  });

  describe('findAll', () => {
    it('should return paginated songs', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Song 1',
            artist: 'Artist 1',
            genre: 'Pop',
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

      mockSongsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(findAllSongDto);

      expect(service.findAll).toHaveBeenCalledWith(findAllSongDto);
      expect(result).toEqual(mockResponse);
    });

    it('should return songs with filters', async () => {
      const findAllSongDto: FindAllSongDto = {
        page: 1,
        limit: 10,
        title: 'Test',
        artist: 'Artist',
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

      mockSongsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(findAllSongDto);

      expect(service.findAll).toHaveBeenCalledWith(findAllSongDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOne', () => {
    it('should return a song by id', async () => {
      const mockSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.findOne.mockResolvedValue(mockSong);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockSong);
    });

    it('should convert string id to number', async () => {
      const mockSong = {
        id: 123,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.findOne.mockResolvedValue(mockSong);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockSong);
    });
  });

  describe('update', () => {
    it('should update a song', async () => {
      const updateSongDto: UpdateSongDto = {
        title: 'Updated Title',
      };

      const updatedSong = {
        id: 1,
        title: 'Updated Title',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.update.mockResolvedValue(updatedSong);

      const result = await controller.update('1', updateSongDto);

      expect(service.update).toHaveBeenCalledWith(1, updateSongDto);
      expect(result).toEqual(updatedSong);
    });

    it('should convert string id to number', async () => {
      const updateSongDto: UpdateSongDto = {
        artist: 'New Artist',
      };

      const updatedSong = {
        id: 456,
        title: 'Test Song',
        artist: 'New Artist',
        genre: 'Pop',
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.update.mockResolvedValue(updatedSong);

      const result = await controller.update('456', updateSongDto);

      expect(service.update).toHaveBeenCalledWith(456, updateSongDto);
      expect(result).toEqual(updatedSong);
    });
  });

  describe('remove', () => {
    it('should remove a song', async () => {
      const deletedSong = {
        id: 1,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.remove.mockResolvedValue(deletedSong);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(deletedSong);
    });

    it('should convert string id to number', async () => {
      const deletedSong = {
        id: 789,
        title: 'Test Song',
        artist: 'Test Artist',
        genre: 'Pop',
        is_deleted: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSongsService.remove.mockResolvedValue(deletedSong);

      const result = await controller.remove('789');

      expect(service.remove).toHaveBeenCalledWith(789);
      expect(result).toEqual(deletedSong);
    });
  });
});
