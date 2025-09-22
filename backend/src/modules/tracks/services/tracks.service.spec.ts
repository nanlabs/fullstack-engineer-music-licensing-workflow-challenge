import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { Scene } from '../../scenes/entities/scene.entity';
import { ScenesService } from '../../scenes/services/scenes.service';
import { Song } from '../../songs/entities/song.entity';
import { SongsService } from '../../songs/services/songs.service';
import { CreateTrackDto } from '../dto/create-track.dto';
import { Track } from '../entities/track.entity';
import { TracksRepository } from '../repositories/tracks.repository';
import { TracksService } from './tracks.service';

describe('TracksService', () => {
  let service: TracksService;
  let tracksRepository: jest.Mocked<TracksRepository>;
  let scenesService: jest.Mocked<ScenesService>;
  let songsService: jest.Mocked<SongsService>;

  const mockSong: Song = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    releaseYear: 2023,
    genre: 'Rock',
    durationSeconds: 180,
    tracks: [],
    currentLicenseStatusId: null,
    currentLicenseStatus: null,
    licenseStatusesHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScene: Scene = {
    id: 1,
    name: 'Test Scene',
    description: 'Test Scene Description',
    sceneNumber: 1,
    durationSeconds: 300,
    notes: 'Test notes',
    movieId: 1,
    movie: null,
    tracks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTrack: Track = {
    id: 1,
    name: 'Test Track',
    startTimeSeconds: 10.5,
    endTimeSeconds: 45.2,
    notes: 'Test track notes',
    sceneId: 1,
    scene: mockScene,
    songId: 1,
    song: mockSong,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateTrackDto: CreateTrackDto = {
    name: 'Test Track',
    startTimeSeconds: 10.5,
    endTimeSeconds: 45.2,
    notes: 'Test track notes',
    sceneId: 1,
    songId: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: TracksRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findBySceneId: jest.fn(),
            findByMovieId: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ScenesService,
          useValue: {
            exists: jest.fn(),
          },
        },
        {
          provide: SongsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
    tracksRepository = module.get(TracksRepository);
    scenesService = module.get(ScenesService);
    songsService = module.get(SongsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a track successfully and associate it with a song', async () => {
      // Arrange
      scenesService.exists.mockResolvedValue(true);
      songsService.findOne.mockResolvedValue(mockSong);
      tracksRepository.create.mockResolvedValue(mockTrack);
      tracksRepository.findById.mockResolvedValue(mockTrack);

      // Act
      const result = await service.create(mockCreateTrackDto);

      // Assert
      expect(scenesService.exists).toHaveBeenCalledWith(1);
      expect(songsService.findOne).toHaveBeenCalledWith(1);
      expect(tracksRepository.create).toHaveBeenCalledWith(mockCreateTrackDto);
      expect(tracksRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTrack);
      expect(result.songId).toBe(1);
      expect(result.sceneId).toBe(1);
    });

    it('should throw BadRequestException for invalid timing (end time before start time)', async () => {
      // Arrange
      const invalidTrackDto = {
        ...mockCreateTrackDto,
        startTimeSeconds: 50.0,
        endTimeSeconds: 10.0,
      };

      // Act & Assert
      await expect(service.create(invalidTrackDto)).rejects.toThrow(
        new BadRequestException('End time must be after start time'),
      );
      expect(scenesService.exists).not.toHaveBeenCalled();
      expect(songsService.findOne).not.toHaveBeenCalled();
      expect(tracksRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid timing (equal start and end time)', async () => {
      // Arrange
      const invalidTrackDto = {
        ...mockCreateTrackDto,
        startTimeSeconds: 30.0,
        endTimeSeconds: 30.0,
      };

      // Act & Assert
      await expect(service.create(invalidTrackDto)).rejects.toThrow(
        new BadRequestException('End time must be after start time'),
      );
    });

    it('should throw BadRequestException for negative start time', async () => {
      // Arrange
      const invalidTrackDto = {
        ...mockCreateTrackDto,
        startTimeSeconds: -5.0,
      };

      // Act & Assert
      await expect(service.create(invalidTrackDto)).rejects.toThrow(
        new BadRequestException('Start time cannot be negative'),
      );
    });

    it('should throw NotFoundException when scene does not exist', async () => {
      // Arrange
      scenesService.exists.mockRejectedValue(new NotFoundException('Scene not found'));

      // Act & Assert
      await expect(service.create(mockCreateTrackDto)).rejects.toThrow(NotFoundException);
      expect(scenesService.exists).toHaveBeenCalledWith(1);
      expect(songsService.findOne).not.toHaveBeenCalled();
      expect(tracksRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when song does not exist', async () => {
      // Arrange
      scenesService.exists.mockResolvedValue(true);
      songsService.findOne.mockRejectedValue(new NotFoundException('Song with ID 1 not found'));

      // Act & Assert
      await expect(service.create(mockCreateTrackDto)).rejects.toThrow(
        new NotFoundException('Song with ID 1 not found'),
      );
      expect(scenesService.exists).toHaveBeenCalledWith(1);
      expect(songsService.findOne).toHaveBeenCalledWith(1);
      expect(tracksRepository.create).not.toHaveBeenCalled();
    });

    it('should handle song service returning null (additional safety check)', async () => {
      // Arrange
      scenesService.exists.mockResolvedValue(true);
      songsService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockCreateTrackDto)).rejects.toThrow(
        new NotFoundException('Song with ID 1 not found'),
      );
    });
  });

  describe('findOne', () => {
    it('should return a track when found', async () => {
      // Arrange
      tracksRepository.findById.mockResolvedValue(mockTrack);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(tracksRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTrack);
    });

    it('should throw NotFoundException when track not found', async () => {
      // Arrange
      tracksRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('Track with ID 999 not found'),
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of tracks', async () => {
      // Arrange
      const mockTracks = [mockTrack];
      tracksRepository.findAll.mockResolvedValue(mockTracks);

      // Act
      const result = await service.findAll();

      // Assert
      expect(tracksRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockTracks);
    });
  });

  describe('findByScene', () => {
    it('should return tracks for a specific scene', async () => {
      // Arrange
      const mockTracks = [mockTrack];
      tracksRepository.findBySceneId.mockResolvedValue(mockTracks);

      // Act
      const result = await service.findByScene(1);

      // Assert
      expect(tracksRepository.findBySceneId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTracks);
    });
  });

  describe('findByMovie', () => {
    it('should return tracks for a specific movie', async () => {
      // Arrange
      const mockTracks = [mockTrack];
      tracksRepository.findByMovieId.mockResolvedValue(mockTracks);

      // Act
      const result = await service.findByMovie(1);

      // Assert
      expect(tracksRepository.findByMovieId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTracks);
    });
  });

  describe('remove', () => {
    it('should remove a track successfully', async () => {
      // Arrange
      tracksRepository.findById.mockResolvedValue(mockTrack);
      tracksRepository.remove.mockResolvedValue(undefined);

      // Act
      await service.remove(1);

      // Assert
      expect(tracksRepository.findById).toHaveBeenCalledWith(1);
      expect(tracksRepository.remove).toHaveBeenCalledWith(mockTrack);
    });

    it('should throw NotFoundException when removing non-existent track', async () => {
      // Arrange
      tracksRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(999)).rejects.toThrow(
        new NotFoundException('Track with ID 999 not found'),
      );
    });
  });

  describe('findByScene with licensing information', () => {
    it('should return tracks for a scene with license status information', async () => {
      // Arrange
      const mockLicenseStatus = {
        id: 1,
        status: LicenseStatusEnum.APPROVED,
        songId: 1,
        song: mockSong,
        createdAt: new Date(),
      };

      const trackWithLicensing = {
        ...mockTrack,
        song: {
          ...mockSong,
          currentLicenseStatus: mockLicenseStatus,
        },
      };

      tracksRepository.findBySceneId.mockResolvedValue([trackWithLicensing]);

      // Act
      const result = await service.findByScene(1);

      // Assert
      expect(tracksRepository.findBySceneId).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].song.currentLicenseStatus).toBeDefined();
      expect(result[0].song.currentLicenseStatus.status).toBe(LicenseStatusEnum.APPROVED);
    });

    it('should return tracks for a scene with pending license status', async () => {
      // Arrange
      const mockLicenseStatus = {
        id: 1,
        status: LicenseStatusEnum.PENDING,
        songId: 1,
        song: mockSong,
        createdAt: new Date(),
      };

      const trackWithPendingLicense = {
        ...mockTrack,
        song: {
          ...mockSong,
          currentLicenseStatus: mockLicenseStatus,
        },
      };

      tracksRepository.findBySceneId.mockResolvedValue([trackWithPendingLicense]);

      // Act
      const result = await service.findByScene(1);

      // Assert
      expect(result[0].song.currentLicenseStatus.status).toBe(LicenseStatusEnum.PENDING);
    });

    it('should return tracks for a scene with null license status', async () => {
      // Arrange
      const trackWithoutLicense = {
        ...mockTrack,
        song: {
          ...mockSong,
          currentLicenseStatus: null,
        },
      };

      tracksRepository.findBySceneId.mockResolvedValue([trackWithoutLicense]);

      // Act
      const result = await service.findByScene(1);

      // Assert
      expect(result[0].song.currentLicenseStatus).toBeNull();
    });
  });

  describe('findByMovie with licensing information', () => {
    it('should return tracks for a movie with license status information', async () => {
      // Arrange
      const mockLicenseStatus = {
        id: 1,
        status: LicenseStatusEnum.IN_REVIEW,
        songId: 1,
        song: mockSong,
        createdAt: new Date(),
      };

      const trackWithLicensing = {
        ...mockTrack,
        song: {
          ...mockSong,
          currentLicenseStatus: mockLicenseStatus,
        },
      };

      tracksRepository.findByMovieId.mockResolvedValue([trackWithLicensing]);

      // Act
      const result = await service.findByMovie(1);

      // Assert
      expect(tracksRepository.findByMovieId).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].song.currentLicenseStatus).toBeDefined();
      expect(result[0].song.currentLicenseStatus.status).toBe(LicenseStatusEnum.IN_REVIEW);
    });

    it('should return multiple tracks for a movie with different license statuses', async () => {
      // Arrange
      const approvedLicenseStatus = {
        id: 1,
        status: LicenseStatusEnum.APPROVED,
        songId: 1,
        song: mockSong,
        createdAt: new Date(),
      };

      const rejectedLicenseStatus = {
        id: 2,
        status: LicenseStatusEnum.REJECTED,
        songId: 2,
        song: { ...mockSong, id: 2 },
        createdAt: new Date(),
      };

      const track1 = {
        ...mockTrack,
        id: 1,
        song: {
          ...mockSong,
          id: 1,
          currentLicenseStatus: approvedLicenseStatus,
        },
      };

      const track2 = {
        ...mockTrack,
        id: 2,
        songId: 2,
        song: {
          ...mockSong,
          id: 2,
          currentLicenseStatus: rejectedLicenseStatus,
        },
      };

      tracksRepository.findByMovieId.mockResolvedValue([track1, track2]);

      // Act
      const result = await service.findByMovie(1);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].song.currentLicenseStatus.status).toBe(LicenseStatusEnum.APPROVED);
      expect(result[1].song.currentLicenseStatus.status).toBe(LicenseStatusEnum.REJECTED);
    });

    it('should return empty array when no tracks found for movie', async () => {
      // Arrange
      tracksRepository.findByMovieId.mockResolvedValue([]);

      // Act
      const result = await service.findByMovie(999);

      // Assert
      expect(tracksRepository.findByMovieId).toHaveBeenCalledWith(999);
      expect(result).toEqual([]);
    });
  });
});
