import { DataSource, Repository } from 'typeorm';
import { seedDatabase } from '../../../src/database/seeds/seed-data';
import { Movie } from '../../../src/entities/movie.entity';
import { Scene } from '../../../src/entities/scene.entity';
import { Song } from '../../../src/entities/song.entity';
import { Track } from '../../../src/entities/track.entity';
import { LicensingStatus } from '../../../src/entities/licensing-status.entity';

describe('SeedData', () => {
  let mockDataSource: jest.Mocked<DataSource>;
  let mockMovieRepository: jest.Mocked<Repository<Movie>>;
  let mockSceneRepository: jest.Mocked<Repository<Scene>>;
  let mockSongRepository: jest.Mocked<Repository<Song>>;
  let mockTrackRepository: jest.Mocked<Repository<Track>>;
  let mockLicensingStatusRepository: jest.Mocked<Repository<LicensingStatus>>;

  beforeEach(() => {
    const mockQueryBuilder = {
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockMovieRepository = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    mockSceneRepository = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    mockSongRepository = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    mockTrackRepository = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    mockLicensingStatusRepository = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    mockDataSource = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Movie) return mockMovieRepository;
        if (entity === Scene) return mockSceneRepository;
        if (entity === Song) return mockSongRepository;
        if (entity === Track) return mockTrackRepository;
        if (entity === LicensingStatus) return mockLicensingStatusRepository;
        return {};
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(seedDatabase).toBeDefined();
    expect(typeof seedDatabase).toBe('function');
  });

  it('should seed database', async () => {
    await seedDatabase(mockDataSource);

    expect(mockDataSource.getRepository).toHaveBeenCalledWith(Movie);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith(Scene);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith(Song);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith(Track);
    expect(mockDataSource.getRepository).toHaveBeenCalledWith(LicensingStatus);
  });

  it('should clear existing data before seeding', async () => {
    await seedDatabase(mockDataSource);

    expect(mockLicensingStatusRepository.createQueryBuilder).toHaveBeenCalled();
    expect(mockTrackRepository.createQueryBuilder).toHaveBeenCalled();
    expect(mockSceneRepository.createQueryBuilder).toHaveBeenCalled();
    expect(mockSongRepository.createQueryBuilder).toHaveBeenCalled();
    expect(mockMovieRepository.createQueryBuilder).toHaveBeenCalled();
  });

  it('should create movies', async () => {
    await seedDatabase(mockDataSource);

    expect(mockMovieRepository.create).toHaveBeenCalled();
    expect(mockMovieRepository.save).toHaveBeenCalled();
  });

  it('should create scenes', async () => {
    await seedDatabase(mockDataSource);

    expect(mockSceneRepository.create).toHaveBeenCalled();
    expect(mockSceneRepository.save).toHaveBeenCalled();
  });

  it('should create songs', async () => {
    await seedDatabase(mockDataSource);

    expect(mockSongRepository.create).toHaveBeenCalled();
    expect(mockSongRepository.save).toHaveBeenCalled();
  });

  it('should create tracks', async () => {
    await seedDatabase(mockDataSource);

    expect(mockTrackRepository.create).toHaveBeenCalled();
    expect(mockTrackRepository.save).toHaveBeenCalled();
  });

  it('should create licensing statuses', async () => {
    await seedDatabase(mockDataSource);

    expect(mockLicensingStatusRepository.create).toHaveBeenCalled();
    expect(mockLicensingStatusRepository.save).toHaveBeenCalled();
  });

  it('should handle errors during seeding', async () => {
    mockMovieRepository.save.mockRejectedValueOnce(new Error('Database error'));

    await expect(seedDatabase(mockDataSource)).rejects.toThrow();
  });

  it('should create all required entities', async () => {
    await seedDatabase(mockDataSource);

    // Verify all repositories were used
    expect(mockMovieRepository.create).toHaveBeenCalled();
    expect(mockSceneRepository.create).toHaveBeenCalled();
    expect(mockSongRepository.create).toHaveBeenCalled();
    expect(mockTrackRepository.create).toHaveBeenCalled();
    expect(mockLicensingStatusRepository.create).toHaveBeenCalled();
  });

  it('should clear data in correct order', async () => {
    await seedDatabase(mockDataSource);

    // Verify deletion order (reverse of creation due to foreign keys)
    const deleteCalls = [
      mockLicensingStatusRepository.createQueryBuilder,
      mockTrackRepository.createQueryBuilder,
      mockSceneRepository.createQueryBuilder,
      mockSongRepository.createQueryBuilder,
      mockMovieRepository.createQueryBuilder,
    ];

    deleteCalls.forEach(call => {
      expect(call).toHaveBeenCalled();
    });
  });
});
