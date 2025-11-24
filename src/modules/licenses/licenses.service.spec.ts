/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { License, LicenseStatus } from '../../entities';
import { LicensesService } from './licenses.service';
import { LicensesRepository } from './licenses.repository';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';
import {
  ResourceNotFoundException,
  InvalidStateTransitionException,
} from '../../common/exceptions';
import { TracksRepository } from '../tracks/tracks.repository';

describe('LicensesService', () => {
  let service: LicensesService;
  let mockRepository: jest.Mocked<LicensesRepository>;
  let mockUpdatesGateway: any;
  let mockTracksRepository: jest.Mocked<TracksRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByTrackId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockUpdatesGateway = {
      emitLicenseUpdate: jest.fn(),
    };

    mockTracksRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        {
          provide: LicensesRepository,
          useValue: mockRepository,
        },
        {
          provide: LicensesUpdatesGateway,
          useValue: mockUpdatesGateway,
        },
        {
          provide: TracksRepository,
          useValue: mockTracksRepository,
        },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a license', async () => {
      const createLicenseDto: CreateLicenseDto = {
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Initial license request',
      };

      const mockTrack = {
        id: 'track-1',
        name: 'Main Theme',
      } as any;

      const mockLicense = {
        id: 'license-1',
        ...createLicenseDto,
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockTracksRepository.findOne.mockResolvedValue(mockTrack);
      mockRepository.create.mockResolvedValue(mockLicense);

      const result = await service.create(createLicenseDto);

      expect(mockTracksRepository.findOne).toHaveBeenCalledWith('track-1');
      expect(mockRepository.create).toHaveBeenCalledWith(createLicenseDto);
      expect(result).toEqual(mockLicense);
    });

    it('should throw ResourceNotFoundException when track does not exist', async () => {
      const createLicenseDto: CreateLicenseDto = {
        trackId: 'non-existent-track',
        status: LicenseStatus.PENDING,
        notes: 'Initial license request',
      };

      mockTracksRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createLicenseDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of licenses with relations', async () => {
      const mockLicenses = [
        {
          id: 'license-1',
          trackId: 'track-1',
          status: LicenseStatus.PENDING,
          notes: 'Pending approval',
          track: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'license-2',
          trackId: 'track-2',
          status: LicenseStatus.APPROVED,
          notes: 'Approved',
          track: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as License[];

      mockRepository.findAll.mockResolvedValue(mockLicenses);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockLicenses);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array when no licenses exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a license by id with relations', async () => {
      const mockLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Pending approval',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockRepository.findOne.mockResolvedValue(mockLicense);

      const result = await service.findOne('license-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('license-1');
      expect(result).toEqual(mockLicense);
    });

    it('should throw ResourceNotFoundException when license is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('findByTrackId', () => {
    it('should return a license by track id', async () => {
      const mockLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Pending approval',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockRepository.findByTrackId.mockResolvedValue(mockLicense);

      const result = await service.findByTrackId('track-1');

      expect(mockRepository.findByTrackId).toHaveBeenCalledWith('track-1');
      expect(result).toEqual(mockLicense);
    });

    it('should return null when no license found for track', async () => {
      mockRepository.findByTrackId.mockResolvedValue(null);

      const result = await service.findByTrackId('non-existent-track');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update license status and emit update event', async () => {
      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.NEGOTIATING,
        notes: 'Starting negotiations',
      };

      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Initial request',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      const updatedLicense = {
        ...currentLicense,
        status: LicenseStatus.NEGOTIATING,
        notes: 'Starting negotiations',
      } as License;

      mockRepository.findOne
        .mockResolvedValueOnce(currentLicense)
        .mockResolvedValueOnce(updatedLicense);
      mockRepository.update.mockResolvedValue(undefined);

      const result = await service.updateStatus('license-1', updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        'license-1',
        updateDto,
      );
      expect(mockUpdatesGateway.emitLicenseUpdate).toHaveBeenCalledWith(
        updatedLicense,
      );
      expect(result).toEqual(updatedLicense);
    });

    it('should throw ResourceNotFoundException when license not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.APPROVED,
      };

      await expect(
        service.updateStatus('non-existent-id', updateDto),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw InvalidStateTransitionException on invalid state transition', async () => {
      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.APPROVED,
        notes: 'Already approved',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockRepository.findOne.mockResolvedValue(currentLicense);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.PENDING,
      };

      await expect(
        service.updateStatus('license-1', updateDto),
      ).rejects.toThrow(InvalidStateTransitionException);
    });

    it('should allow transition from PENDING to NEGOTIATING', async () => {
      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Initial',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      const updatedLicense = {
        ...currentLicense,
        status: LicenseStatus.NEGOTIATING,
      } as License;

      mockRepository.findOne
        .mockResolvedValueOnce(currentLicense)
        .mockResolvedValueOnce(updatedLicense);
      mockRepository.update.mockResolvedValue(undefined);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.NEGOTIATING,
      };

      const result = await service.updateStatus('license-1', updateDto);

      expect(result?.status).toBe(LicenseStatus.NEGOTIATING);
    });

    it('should allow transition from PENDING to REJECTED', async () => {
      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Initial',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      const updatedLicense = {
        ...currentLicense,
        status: LicenseStatus.REJECTED,
      } as License;

      mockRepository.findOne
        .mockResolvedValueOnce(currentLicense)
        .mockResolvedValueOnce(updatedLicense);
      mockRepository.update.mockResolvedValue(undefined);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.REJECTED,
      };

      const result = await service.updateStatus('license-1', updateDto);

      expect(result?.status).toBe(LicenseStatus.REJECTED);
    });

    it('should allow transition from NEGOTIATING to APPROVED', async () => {
      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.NEGOTIATING,
        notes: 'In progress',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      const updatedLicense = {
        ...currentLicense,
        status: LicenseStatus.APPROVED,
      } as License;

      mockRepository.findOne
        .mockResolvedValueOnce(currentLicense)
        .mockResolvedValueOnce(updatedLicense);
      mockRepository.update.mockResolvedValue(undefined);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.APPROVED,
      };

      const result = await service.updateStatus('license-1', updateDto);

      expect(result?.status).toBe(LicenseStatus.APPROVED);
    });

    it('should allow transition from REJECTED to PENDING', async () => {
      const currentLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.REJECTED,
        notes: 'Rejected',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      const updatedLicense = {
        ...currentLicense,
        status: LicenseStatus.PENDING,
      } as License;

      mockRepository.findOne
        .mockResolvedValueOnce(currentLicense)
        .mockResolvedValueOnce(updatedLicense);
      mockRepository.update.mockResolvedValue(undefined);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.PENDING,
      };

      const result = await service.updateStatus('license-1', updateDto);

      expect(result?.status).toBe(LicenseStatus.PENDING);
    });
  });

  describe('remove', () => {
    it('should delete a license by id', async () => {
      const mockLicense = {
        id: 'license-1',
        trackId: 'track-1',
        status: LicenseStatus.PENDING,
        notes: 'Pending approval',
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockRepository.findOne.mockResolvedValue(mockLicense);
      mockRepository.remove.mockResolvedValue(undefined);

      const result = await service.remove('license-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('license-1');
      expect(mockRepository.remove).toHaveBeenCalledWith('license-1');
      expect(result.message).toBe('License deleted successfully');
    });

    it('should throw ResourceNotFoundException when deleting non-existent license', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});
