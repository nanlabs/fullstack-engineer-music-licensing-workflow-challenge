import { Test, TestingModule } from '@nestjs/testing';
import { SongController } from './song.controller';
import { SongService } from './song.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

describe('SongController (API Gateway)', () => {
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
    fetch: jest.fn(),
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

  describe('fetch', () => {
    it('should return an array of songs', async () => {
      const songs = [mockSong, { ...mockSong, id: 2, title: 'Stairway to Heaven' }];
      mockSongService.fetch.mockResolvedValue(songs);

      const result = await controller.fetch();

      expect(result).toEqual(songs);
      expect(result).toHaveLength(2);
      expect(mockSongService.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no songs exist', async () => {
      mockSongService.fetch.mockResolvedValue([]);

      const result = await controller.fetch();

      expect(result).toEqual([]);
      expect(mockSongService.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should create and return a new song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Bohemian Rhapsody',
        releaseDate: 1975,
        seconds: 354,
      };
      mockSongService.create.mockResolvedValue(mockSong);

      const result = await controller.create(createSongDto);

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

      const result = await controller.create(shortSong);

      expect(result.seconds).toBe(60);
      expect(mockSongService.create).toHaveBeenCalledWith(shortSong);
    });
  });
});
