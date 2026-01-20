import { Test, TestingModule } from '@nestjs/testing';
import { SongService } from './song.service';
import { ClientRMQ } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';
import { INJECTION_TOKENS, SONG_PATTERNS } from 'libs/shared';

describe('SongService (API Gateway)', () => {
  let service: SongService;

  const mockSong = {
    id: 1,
    title: 'Bohemian Rhapsody',
    releaseDate: 1975,
    seconds: 354,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSongMicroserviceClient = {
    send: jest.fn(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongService,
        {
          provide: INJECTION_TOKENS.SONG_SERVICE,
          useValue: mockSongMicroserviceClient,
        },
      ],
    }).compile();

    service = module.get<SongService>(SongService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message', () => {
      const result = service.getHello();
      expect(result).toBe('Hello World FROM API API Gateway!');
    });
  });

  describe('fetch', () => {
    it('should return an array of songs from microservice', async () => {
      const songs = [mockSong, { ...mockSong, id: 2, title: 'Stairway to Heaven' }];
      mockSongMicroserviceClient.send.mockReturnValue(of(songs));

      const result = await service.fetch();

      expect(result).toEqual(songs);
      expect(mockSongMicroserviceClient.send).toHaveBeenCalledWith('song.fetch.all', {});
    });

    it('should return empty array when no songs exist', async () => {
      mockSongMicroserviceClient.send.mockReturnValue(of([]));

      const result = await service.fetch();

      expect(result).toEqual([]);
      expect(mockSongMicroserviceClient.send).toHaveBeenCalledWith('song.fetch.all', {});
    });

    it('should propagate errors from microservice', async () => {
      const error = new Error('Microservice unavailable');
      mockSongMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(service.fetch()).rejects.toThrow('Microservice unavailable');
    });
  });

  describe('create', () => {
    it('should create and return a new song via microservice', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Bohemian Rhapsody',
        releaseDate: 1975,
        seconds: 354,
      };
      mockSongMicroserviceClient.send.mockReturnValue(of(mockSong));

      const result = await service.create(createSongDto);

      expect(result).toEqual(mockSong);
      expect(mockSongMicroserviceClient.send).toHaveBeenCalledWith(
        'song.create.one',
        createSongDto,
      );
    });

    it('should propagate errors when creating song fails', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Test Song',
        releaseDate: 2023,
        seconds: 180,
      };
      const error = new Error('Creation failed');
      mockSongMicroserviceClient.send.mockReturnValue(throwError(() => error));

      await expect(service.create(createSongDto)).rejects.toThrow('Creation failed');
    });
  });
});
