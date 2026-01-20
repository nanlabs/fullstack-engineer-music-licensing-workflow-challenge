import { Test, TestingModule } from '@nestjs/testing';
import { SongController } from './song.controller';
import { SongService } from './song.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

describe('SongController (Microservice)', () => {
  let controller: SongController;
  let songService: jest.Mocked<SongService>;

  const mockSong = {
    id: 1,
    title: 'Bohemian Rhapsody',
    releaseDate: 1975,
    seconds: 354,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSongService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongController],
      providers: [
        {
          provide: SongService,
          useValue: mockSongService,
        },
      ],
    }).compile();

    controller = module.get<SongController>(SongController);
    songService = module.get(SongService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fetchAllSongs', () => {
    it('should return an array of songs', async () => {
      const songs = [mockSong, { ...mockSong, id: 2, title: 'Stairway to Heaven' }];
      mockSongService.findAll.mockResolvedValue(songs);

      const result = await controller.fetchAllSongs();

      expect(result).toEqual(songs);
      expect(result).toHaveLength(2);
      expect(mockSongService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no songs exist', async () => {
      mockSongService.findAll.mockResolvedValue([]);

      const result = await controller.fetchAllSongs();

      expect(result).toEqual([]);
      expect(mockSongService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchSongById', () => {
    it('should return a song by id', async () => {
      mockSongService.findById.mockResolvedValue(mockSong);

      const result = await controller.fetchSongById({ id: 1 });

      expect(result).toEqual(mockSong);
      expect(mockSongService.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when song not found', async () => {
      mockSongService.findById.mockResolvedValue(null);

      const result = await controller.fetchSongById({ id: 999 });

      expect(result).toBeNull();
      expect(mockSongService.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('createOne', () => {
    it('should create and return a new song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Bohemian Rhapsody',
        releaseDate: 1975,
        seconds: 354,
      };
      mockSongService.create.mockResolvedValue(mockSong);

      const result = await controller.createOne(createSongDto);

      expect(result).toEqual(mockSong);
      expect(mockSongService.create).toHaveBeenCalledWith(createSongDto);
      expect(mockSongService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle songs with different durations', async () => {
      const shortSong: CreateSongDto = {
        title: 'Short Song',
        releaseDate: 2020,
        seconds: 60,
      };
      const expectedSong = { ...mockSong, ...shortSong, id: 2 };
      mockSongService.create.mockResolvedValue(expectedSong);

      const result = await controller.createOne(shortSong);

      expect(result.seconds).toBe(60);
      expect(mockSongService.create).toHaveBeenCalledWith(shortSong);
    });
  });
});
