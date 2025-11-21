/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { License, LicenseStatus } from '../../entities';
import { LicensesService } from './licenses.service';
import { LicensesRepository } from './licenses.repository';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';

describe('LicensesService', () => {
  let service: LicensesService;
  let mockRepository: jest.Mocked<LicensesRepository>;
  let mockUpdatesGateway: any;

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

      const mockLicense = {
        id: 'license-1',
        ...createLicenseDto,
        track: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as License;

      mockRepository.create.mockResolvedValue(mockLicense);

      const result = await service.create(createLicenseDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createLicenseDto);
      expect(result).toEqual(mockLicense);
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

    it('should return null when license is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
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

    it('should throw error when license not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const updateDto: UpdateLicenseStatusDto = {
        status: LicenseStatus.APPROVED,
      };

      await expect(
        service.updateStatus('non-existent-id', updateDto),
      ).rejects.toThrow('License with id non-existent-id not found');
    });

    it('should throw error on invalid state transition', async () => {
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
      ).rejects.toThrow('Invalid state transition from APPROVED to PENDING');
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
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('license-1');

      expect(mockRepository.remove).toHaveBeenCalledWith('license-1');
    });

    it('should handle deletion of non-existent license', async () => {
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove('non-existent-id');

      expect(mockRepository.remove).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
