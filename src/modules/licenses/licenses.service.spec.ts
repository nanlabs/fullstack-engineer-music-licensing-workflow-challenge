import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { License } from '../../entities/license.entity';
import { Track } from '../../entities/track.entity';
import { LicensingStatus } from '../../entities/enums/licensing-status.enum';
import { UpdateLicenseStatusDto } from './dto/update-license-status.dto';
import { EmailService } from '../../services/email.service';
import { CacheService } from '../../services/cache.service';

describe('LicensesService', () => {
  let service: LicensesService;

  const mockLicenseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTrackRepository = {
    findOne: jest.fn(),
  };

  const mockEmailService = {
    sendLicenseStatusChangeNotification: jest.fn(),
    sendBulkNotifications: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockLicense: License = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    status: LicensingStatus.PENDING,
    licenseFee: 1000,
    currency: 'USD',
    notes: 'Test license',
    trackId: '123e4567-e89b-12d3-a456-426614174001',
    lastStatusChange: new Date(),
    track: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test Track',
      scene: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Scene',
        movie: {
          id: '123e4567-e89b-12d3-a456-426614174003',
          title: 'Test Movie',
        },
      },
      song: {
        id: '123e4567-e89b-12d3-a456-426614174004',
        title: 'Test Song',
        artist: 'Test Artist',
      },
    },
  } as License;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        {
          provide: getRepositoryToken(License),
          useValue: mockLicenseRepository,
        },
        {
          provide: getRepositoryToken(Track),
          useValue: mockTrackRepository,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateStatus', () => {
    it('should successfully update license status from PENDING to IN_REVIEW', async () => {
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.IN_REVIEW,
        notes: 'Starting review process',
      };

      mockLicenseRepository.findOne.mockResolvedValue(mockLicense);
      mockLicenseRepository.save.mockResolvedValue({
        ...mockLicense,
        status: LicensingStatus.IN_REVIEW,
        notes: updateDto.notes,
      });

      const result = await service.updateStatus(mockLicense.id, updateDto);

      expect(result.status).toBe(LicensingStatus.IN_REVIEW);
      expect(result.notes).toBe(updateDto.notes);
      expect(mockLicenseRepository.save).toHaveBeenCalled();
    });

    it('should allow status update from IN_REVIEW to APPROVED (skipping NEGOTIATING)', async () => {
      const licenseInReview = { ...mockLicense, status: LicensingStatus.IN_REVIEW };
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.APPROVED,
        notes: 'Fast-track approval',
      };

      mockLicenseRepository.findOne.mockResolvedValue(licenseInReview);
      mockLicenseRepository.save.mockResolvedValue({
        ...licenseInReview,
        status: LicensingStatus.APPROVED,
      });

      const result = await service.updateStatus(mockLicense.id, updateDto);

      expect(result.status).toBe(LicensingStatus.APPROVED);
    });

    it('should allow rejection from any active status', async () => {
      const licenseNegotiating = { ...mockLicense, status: LicensingStatus.NEGOTIATING };
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.REJECTED,
        notes: 'Rights holder declined',
      };

      mockLicenseRepository.findOne.mockResolvedValue(licenseNegotiating);
      mockLicenseRepository.save.mockResolvedValue({
        ...licenseNegotiating,
        status: LicensingStatus.REJECTED,
      });
      mockEmailService.sendLicenseStatusChangeNotification.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.updateStatus(mockLicense.id, updateDto);

      expect(result.status).toBe(LicensingStatus.REJECTED);
      expect(mockEmailService.sendLicenseStatusChangeNotification).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith('workflow-summary');
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const approvedLicense = { ...mockLicense, status: LicensingStatus.APPROVED };
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.PENDING,
        notes: 'Trying to go backwards',
      };

      mockLicenseRepository.findOne.mockResolvedValue(approvedLicense);

      await expect(service.updateStatus(mockLicense.id, updateDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent license', async () => {
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.IN_REVIEW,
      };

      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent-id', updateDto))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should allow APPROVED to EXPIRED transition', async () => {
      const approvedLicense = { ...mockLicense, status: LicensingStatus.APPROVED };
      const updateDto: UpdateLicenseStatusDto = {
        status: LicensingStatus.EXPIRED,
        notes: 'License period ended',
      };

      mockLicenseRepository.findOne.mockResolvedValue(approvedLicense);
      mockLicenseRepository.save.mockResolvedValue({
        ...approvedLicense,
        status: LicensingStatus.EXPIRED,
      });
      mockEmailService.sendLicenseStatusChangeNotification.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.updateStatus(mockLicense.id, updateDto);

      expect(result.status).toBe(LicensingStatus.EXPIRED);
      expect(mockEmailService.sendLicenseStatusChangeNotification).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith('workflow-summary');
    });
  });

  describe('getWorkflowSummary', () => {
    it('should return correct license counts by status', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'pending', count: '2' },
          { status: 'in_review', count: '1' },
          { status: 'approved', count: '3' },
        ]),
      };

      mockLicenseRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getWorkflowSummary();

      expect(result).toEqual({
        pending: 2,
        in_review: 1,
        negotiating: 0,
        approved: 3,
        rejected: 0,
        expired: 0,
      });
    });
  });

  describe('findAll', () => {
    it('should return all licenses with relations', async () => {
      mockLicenseRepository.find.mockResolvedValue([mockLicense]);

      const result = await service.findAll();

      expect(result).toEqual([mockLicense]);
      expect(mockLicenseRepository.find).toHaveBeenCalledWith({
        relations: ['track', 'track.scene', 'track.song'],
      });
    });
  });

  describe('findOne', () => {
    it('should return license with relations when found', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(mockLicense);

      const result = await service.findOne(mockLicense.id);

      expect(result).toEqual(mockLicense);
    });

    it('should throw NotFoundException when license not found', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });


  describe('Workflow Summary with Caching', () => {
    it('should return cached workflow summary when available', async () => {
      const cachedSummary = {
        pending: 2,
        in_review: 1,
        negotiating: 0,
        approved: 3,
        rejected: 0,
        expired: 0,
      };

      mockCacheService.get.mockResolvedValue(cachedSummary);

      const result = await service.getWorkflowSummary();

      expect(result).toEqual(cachedSummary);
      expect(mockCacheService.get).toHaveBeenCalledWith('workflow-summary');
      expect(mockLicenseRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when no cached data', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'pending', count: '2' },
          { status: 'in_review', count: '1' },
          { status: 'approved', count: '3' },
        ]),
      };

      mockCacheService.get.mockResolvedValue(null);
      mockLicenseRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getWorkflowSummary();

      expect(result).toEqual({
        pending: 2,
        in_review: 1,
        negotiating: 0,
        approved: 3,
        rejected: 0,
        expired: 0,
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('workflow-summary', result, 300);
    });
  });

});