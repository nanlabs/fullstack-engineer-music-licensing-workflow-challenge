import { Test, TestingModule } from '@nestjs/testing';
import { TracksService } from './tracks.service';
import { TracksRepository } from './tracks.repository';
import { LicensingStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('TracksService', () => {
  let service: TracksService;
  let repository: TracksRepository;

  const mockTracksRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRedisPublisher = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: TracksRepository, useValue: mockTracksRepository },
        { provide: 'REDIS_PUBLISHER', useValue: mockRedisPublisher },
      ],
    }).compile();

    service = module.get<TracksService>(TracksService);
    repository = module.get<TracksRepository>(TracksRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should update status successfully for valid transition (PENDING -> NEGOTIATING)', async () => {
      const trackId = 'track-1';
      const currentTrack = { id: trackId, status: LicensingStatus.PENDING };
      const updateDto = { status: LicensingStatus.NEGOTIATING };
      const updatedTrack = { ...currentTrack, ...updateDto };

      mockTracksRepository.findOne.mockResolvedValue(currentTrack);
      mockTracksRepository.update.mockResolvedValue(updatedTrack);

      const result = await service.update(trackId, updateDto);

      expect(repository.findOne).toHaveBeenCalledWith(trackId);
      expect(repository.update).toHaveBeenCalledWith(trackId, updateDto);
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith('track_updates', JSON.stringify({ trackId, status: LicensingStatus.NEGOTIATING }));
      expect(result).toEqual(updatedTrack);
    });

    it('should throw BadRequestException for invalid transition (PENDING -> APPROVED)', async () => {
      const trackId = 'track-1';
      const currentTrack = { id: trackId, status: LicensingStatus.PENDING };
      const updateDto = { status: LicensingStatus.APPROVED };

      mockTracksRepository.findOne.mockResolvedValue(currentTrack);

      await expect(service.update(trackId, updateDto)).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(mockRedisPublisher.publish).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if track not found', async () => {
      mockTracksRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { status: LicensingStatus.APPROVED })).rejects.toThrow(BadRequestException);
    });
  });
});
