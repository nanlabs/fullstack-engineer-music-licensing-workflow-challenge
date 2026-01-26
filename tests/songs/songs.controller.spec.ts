import { Test, TestingModule } from '@nestjs/testing';
import { SongsController } from '../../src/songs/songs.controller';
import { SongsService } from '../../src/songs/songs.service';
import { CreateSongDto } from '../../src/songs/dto/create-song.dto';

describe('SongsController', () => {
  let controller: SongsController;
  let service: SongsService;

  const mockSong = {
    id: '1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'Rock',
    duration: 180,
    rightsHolder: 'Test Records',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    it('should create a song', async () => {
      const createDto: CreateSongDto = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        genre: 'Rock',
        duration: 180,
        rightsHolder: 'Test Records',
      };

      mockSongsService.create.mockResolvedValue(mockSong);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockSong);
    });
  });

  describe('findAll', () => {
    it('should return an array of songs', async () => {
      const paginationDto = { page: 1, limit: 10 };
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
      mockSongsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(paginationDto);

      expect(service.findAll).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should return a song by id', async () => {
      mockSongsService.findOne.mockResolvedValue(mockSong);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockSong);
    });
  });

  describe('update', () => {
    it('should update a song', async () => {
      const updateDto = { title: 'Updated Title' };
      const updatedSong = { ...mockSong, ...updateDto };

      mockSongsService.update.mockResolvedValue(updatedSong);

      const result = await controller.update('1', updateDto);

      expect(service.update).toHaveBeenCalledWith('1', updateDto);
      expect(result).toEqual(updatedSong);
    });
  });

  describe('remove', () => {
    it('should delete a song', async () => {
      mockSongsService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
