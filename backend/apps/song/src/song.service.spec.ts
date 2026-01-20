import { Test, TestingModule } from '@nestjs/testing';
import { SongService } from './song.service';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { CreateSongDto } from 'libs/shared/dto/create-song.dto';

describe('SongService (Microservice)', () => {
  let service: SongService;
  let typeOrmRepositoryService: jest.Mocked<TypeOrmRepositoryService>;

  const mockSong = {
    id: 1,
    title: 'Bohemian Rhapsody',
    releaseDate: 1975,
    seconds: 354,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSongRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    createOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockTypeOrmRepositoryService = {
    songRepository: mockSongRepository,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongService,
        {
          provide: TypeOrmRepositoryService,
          useValue: mockTypeOrmRepositoryService,
        },
      ],
    }).compile();

    service = module.get<SongService>(SongService);
    typeOrmRepositoryService = module.get(TypeOrmRepositoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of songs', async () => {
      const songs = [mockSong, { ...mockSong, id: 2, title: 'Stairway to Heaven' }];
      mockSongRepository.findAll.mockResolvedValue(songs);

      const result = await service.findAll();

      expect(result).toEqual(songs);
      expect(result).toHaveLength(2);
      expect(mockSongRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no songs exist', async () => {
      mockSongRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(mockSongRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return a song by id', async () => {
      mockSongRepository.findById.mockResolvedValue(mockSong);

      const result = await service.findById(1);

      expect(result).toEqual(mockSong);
      expect(mockSongRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should return null when song not found', async () => {
      mockSongRepository.findById.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
      expect(mockSongRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('create', () => {
    it('should create and return a new song', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Bohemian Rhapsody',
        releaseDate: 1975,
        seconds: 354,
      };
      mockSongRepository.createOne.mockResolvedValue(mockSong);

      const result = await service.create(createSongDto);

      expect(result).toEqual(mockSong);
      expect(mockSongRepository.createOne).toHaveBeenCalledTimes(1);
      expect(mockSongRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createSongDto.title,
          releaseDate: createSongDto.releaseDate,
          seconds: createSongDto.seconds,
        }),
      );
    });

    it('should create song with minimum duration', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Short Jingle',
        releaseDate: 2023,
        seconds: 1,
      };
      const shortSong = { ...mockSong, ...createSongDto, id: 2 };
      mockSongRepository.createOne.mockResolvedValue(shortSong);

      const result = await service.create(createSongDto);

      expect(result.seconds).toBe(1);
      expect(mockSongRepository.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ seconds: 1 }),
      );
    });

    it('should create song with maximum duration', async () => {
      const createSongDto: CreateSongDto = {
        title: 'Epic Symphony',
        releaseDate: 2023,
        seconds: 7200,
      };
      const longSong = { ...mockSong, ...createSongDto, id: 3 };
      mockSongRepository.createOne.mockResolvedValue(longSong);

      const result = await service.create(createSongDto);

      expect(result.seconds).toBe(7200);
    });
  });
});
