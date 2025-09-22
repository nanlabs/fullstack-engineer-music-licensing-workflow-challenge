import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { LicenseUpdateGateway } from '../../../common/gateways/license-update.gateway';
import { Song } from '../../songs/entities/song.entity';
import { SongsService } from '../../songs/services/songs.service';
import { Track } from '../../tracks/entities/track.entity';
import { TracksService } from '../../tracks/services/tracks.service';
import { UpdateLicenseStatusDto } from '../dto/update-license-status.dto';
import { LicenseStatus } from '../entities/license-status.entity';
import { LicensesRepository } from '../repositories/licenses.repository';
import { LicensesService } from './licenses.service';

describe('LicensesService', () => {
  let service: LicensesService;
  let licensesRepository: jest.Mocked<LicensesRepository>;
  let songsService: jest.Mocked<SongsService>;
  let tracksService: jest.Mocked<TracksService>;
  let licenseUpdateGateway: jest.Mocked<LicenseUpdateGateway>;

  const mockSong: Song = {
    id: 1,
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    releaseYear: 2023,
    genre: 'Rock',
    durationSeconds: 180,
    tracks: [],
    currentLicenseStatusId: 1,
    currentLicenseStatus: null,
    licenseStatusesHistory: [],
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
    scene: null,
    songId: 1,
    song: mockSong,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLicenseStatus: LicenseStatus = {
    id: 1,
    status: LicenseStatusEnum.PENDING,
    songId: 1,
    song: mockSong,
    createdAt: new Date(),
  };

  const mockUpdateLicenseStatusDto: UpdateLicenseStatusDto = {
    status: LicenseStatusEnum.IN_REVIEW,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        {
          provide: LicensesRepository,
          useValue: {
            findBySongId: jest.fn(),
            create: jest.fn(),
            updateSongCurrentLicenseStatus: jest.fn(),
            getStatusStatistics: jest.fn(),
          },
        },
        {
          provide: SongsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: TracksService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: LicenseUpdateGateway,
          useValue: {
            emitLicenseStatusUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
    licensesRepository = module.get(LicensesRepository);
    songsService = module.get(SongsService);
    tracksService = module.get(TracksService);
    licenseUpdateGateway = module.get(LicenseUpdateGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateSongLicenseStatus', () => {
    it('should update song license status successfully', async () => {
      // Arrange
      const newLicenseStatus = {
        ...mockLicenseStatus,
        id: 2,
        status: LicenseStatusEnum.IN_REVIEW,
      };

      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue([mockLicenseStatus]);
      licensesRepository.create.mockResolvedValue(newLicenseStatus);
      licensesRepository.updateSongCurrentLicenseStatus.mockResolvedValue(undefined);

      // Act
      const result = await service.updateSongLicenseStatus(1, mockUpdateLicenseStatusDto);

      // Assert
      expect(songsService.findOne).toHaveBeenCalledWith(1);
      expect(licensesRepository.findBySongId).toHaveBeenCalledWith(1);
      expect(licensesRepository.create).toHaveBeenCalledWith(
        {
          songId: 1,
          status: LicenseStatusEnum.IN_REVIEW,
        },
        mockSong,
      );
      expect(licensesRepository.updateSongCurrentLicenseStatus).toHaveBeenCalledWith(1, 2);
      expect(licenseUpdateGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith({
        songId: 1,
        newStatus: newLicenseStatus,
      });
      expect(result).toEqual(newLicenseStatus);
    });

    it('should throw NotFoundException when song does not exist', async () => {
      // Arrange
      songsService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateSongLicenseStatus(999, mockUpdateLicenseStatusDto),
      ).rejects.toThrow(new NotFoundException('Song with ID 999 not found'));
    });

    it('should handle initial license status creation (no previous status)', async () => {
      // Arrange
      const initialLicenseStatus = {
        ...mockLicenseStatus,
        status: LicenseStatusEnum.PENDING,
      };

      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue([]); // No previous status
      licensesRepository.create.mockResolvedValue(initialLicenseStatus);
      licensesRepository.updateSongCurrentLicenseStatus.mockResolvedValue(undefined);

      // Act
      const result = await service.updateSongLicenseStatus(1, {
        status: LicenseStatusEnum.PENDING,
      });

      // Assert
      expect(result).toEqual(initialLicenseStatus);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      // Arrange
      const approvedStatus = {
        ...mockLicenseStatus,
        status: LicenseStatusEnum.APPROVED,
      };

      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue([approvedStatus]);

      // Act & Assert - Try to transition from APPROVED to PENDING (invalid)
      await expect(
        service.updateSongLicenseStatus(1, { status: LicenseStatusEnum.PENDING }),
      ).rejects.toThrow(
        new BadRequestException('Invalid status transition from approved to pending'),
      );
    });

    it('should allow valid status transitions', async () => {
      // Test each valid transition
      const validTransitions = [
        { from: LicenseStatusEnum.PENDING, to: LicenseStatusEnum.IN_REVIEW },
        { from: LicenseStatusEnum.PENDING, to: LicenseStatusEnum.REJECTED },
        { from: LicenseStatusEnum.IN_REVIEW, to: LicenseStatusEnum.NEGOTIATING },
        { from: LicenseStatusEnum.IN_REVIEW, to: LicenseStatusEnum.APPROVED },
        { from: LicenseStatusEnum.IN_REVIEW, to: LicenseStatusEnum.REJECTED },
        { from: LicenseStatusEnum.IN_REVIEW, to: LicenseStatusEnum.PENDING },
        { from: LicenseStatusEnum.NEGOTIATING, to: LicenseStatusEnum.APPROVED },
        { from: LicenseStatusEnum.NEGOTIATING, to: LicenseStatusEnum.REJECTED },
        { from: LicenseStatusEnum.NEGOTIATING, to: LicenseStatusEnum.IN_REVIEW },
        { from: LicenseStatusEnum.APPROVED, to: LicenseStatusEnum.EXPIRED },
        { from: LicenseStatusEnum.APPROVED, to: LicenseStatusEnum.NEGOTIATING },
        { from: LicenseStatusEnum.REJECTED, to: LicenseStatusEnum.PENDING },
        { from: LicenseStatusEnum.REJECTED, to: LicenseStatusEnum.IN_REVIEW },
        { from: LicenseStatusEnum.EXPIRED, to: LicenseStatusEnum.PENDING },
        { from: LicenseStatusEnum.EXPIRED, to: LicenseStatusEnum.NEGOTIATING },
      ];

      for (const { from, to } of validTransitions) {
        // Arrange
        const currentStatus = { ...mockLicenseStatus, status: from };
        const newStatus = { ...mockLicenseStatus, id: 2, status: to };

        songsService.findOne.mockResolvedValue(mockSong);
        licensesRepository.findBySongId.mockResolvedValue([currentStatus]);
        licensesRepository.create.mockResolvedValue(newStatus);
        licensesRepository.updateSongCurrentLicenseStatus.mockResolvedValue(undefined);

        // Act
        const result = await service.updateSongLicenseStatus(1, { status: to });

        // Assert
        expect(result.status).toBe(to);
      }
    });

    it('should handle WebSocket emission failure gracefully', async () => {
      // Arrange
      const newLicenseStatus = {
        ...mockLicenseStatus,
        id: 2,
        status: LicenseStatusEnum.IN_REVIEW,
      };

      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue([mockLicenseStatus]);
      licensesRepository.create.mockResolvedValue(newLicenseStatus);
      licensesRepository.updateSongCurrentLicenseStatus.mockResolvedValue(undefined);
      licenseUpdateGateway.emitLicenseStatusUpdate.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      // Act & Assert - Should not throw error even if WebSocket fails
      const result = await service.updateSongLicenseStatus(1, mockUpdateLicenseStatusDto);
      expect(result).toEqual(newLicenseStatus);
    });
  });

  describe('updateSongLicenseStatusByTrack', () => {
    it('should update license status through track successfully', async () => {
      // Arrange
      const newLicenseStatus = {
        ...mockLicenseStatus,
        id: 2,
        status: LicenseStatusEnum.IN_REVIEW,
      };

      tracksService.findOne.mockResolvedValue(mockTrack);
      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue([mockLicenseStatus]);
      licensesRepository.create.mockResolvedValue(newLicenseStatus);
      licensesRepository.updateSongCurrentLicenseStatus.mockResolvedValue(undefined);

      // Act
      const result = await service.updateSongLicenseStatusByTrack(1, mockUpdateLicenseStatusDto);

      // Assert
      expect(tracksService.findOne).toHaveBeenCalledWith(1);
      expect(songsService.findOne).toHaveBeenCalledWith(1); // songId from track
      expect(result).toEqual(newLicenseStatus);
    });

    it('should throw NotFoundException when track does not exist', async () => {
      // Arrange
      tracksService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateSongLicenseStatusByTrack(999, mockUpdateLicenseStatusDto),
      ).rejects.toThrow(new NotFoundException('Track with ID 999 not found'));
    });

    it('should throw BadRequestException when track has no associated song', async () => {
      // Arrange
      const trackWithoutSong = { ...mockTrack, songId: null };
      tracksService.findOne.mockResolvedValue(trackWithoutSong);

      // Act & Assert
      await expect(
        service.updateSongLicenseStatusByTrack(1, mockUpdateLicenseStatusDto),
      ).rejects.toThrow(new BadRequestException('Track with ID 1 has no associated song'));
    });
  });

  describe('getLicenseHistory', () => {
    it('should return license history for a song', async () => {
      // Arrange
      const licenseHistory = [mockLicenseStatus];
      songsService.findOne.mockResolvedValue(mockSong);
      licensesRepository.findBySongId.mockResolvedValue(licenseHistory);

      // Act
      const result = await service.getLicenseHistory(1);

      // Assert
      expect(songsService.findOne).toHaveBeenCalledWith(1);
      expect(licensesRepository.findBySongId).toHaveBeenCalledWith(1);
      expect(result).toEqual(licenseHistory);
    });

    it('should throw NotFoundException when song does not exist', async () => {
      // Arrange
      songsService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLicenseHistory(999)).rejects.toThrow(
        new NotFoundException('Song with ID 999 not found'),
      );
    });
  });

  describe('getCurrentLicenseStatus', () => {
    it('should return current license status for a song', async () => {
      // Arrange
      const songWithCurrentStatus = {
        ...mockSong,
        currentLicenseStatus: mockLicenseStatus,
      };
      songsService.findOne.mockResolvedValue(songWithCurrentStatus);

      // Act
      const result = await service.getCurrentLicenseStatus(1);

      // Assert
      expect(songsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockLicenseStatus);
    });

    it('should return null when song has no current license status', async () => {
      // Arrange
      songsService.findOne.mockResolvedValue(mockSong);

      // Act
      const result = await service.getCurrentLicenseStatus(1);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw NotFoundException when song does not exist', async () => {
      // Arrange
      songsService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCurrentLicenseStatus(999)).rejects.toThrow(
        new NotFoundException('Song with ID 999 not found'),
      );
    });
  });
});
