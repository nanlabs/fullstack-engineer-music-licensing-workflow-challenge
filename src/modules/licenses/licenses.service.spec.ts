import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LicensesService } from './licenses.service';
import { Track } from '../tracks/entities/track.entity';
import { License } from './entities/license.entity';
import { Status } from './entities/status.entity';
import { LicenseStatusHistory } from './entities/license-status-history.entity';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseStatusDto } from './dto/updateStatus-license.dto';
import { LicenseStatusEnum } from './entities/license.status.enum';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';

describe('LicensesService', () => {
  let service: LicensesService;

  const mockTrackRepository = {
    findOneBy: jest.fn(),
  };

  const mockStatusRepository = {
    findOneBy: jest.fn(),
  };

  const mockLicenseRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockLicenseStatusHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockWebsocketGateway = {
    emitLicenseStatusUpdate: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn((key: string) => key),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        {
          provide: getRepositoryToken(Track),
          useValue: mockTrackRepository,
        },
        {
          provide: getRepositoryToken(Status),
          useValue: mockStatusRepository,
        },
        {
          provide: getRepositoryToken(License),
          useValue: mockLicenseRepository,
        },
        {
          provide: getRepositoryToken(LicenseStatusHistory),
          useValue: mockLicenseStatusHistoryRepository,
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a license for a track and set to PENDING', async () => {
      const createLicenseDto: CreateLicenseDto = {
        track_id: 1,
      };

      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
      };

      const mockLicense = {
        id: 1,
        track_id: 1,
        status_id: null,
      };

      const savedLicense = {
        ...mockLicense,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockTrackRepository.findOneBy.mockResolvedValue(mockTrack);
      mockLicenseRepository.findOneBy.mockResolvedValue(null);
      mockLicenseRepository.create.mockReturnValue(mockLicense);
      mockLicenseRepository.save.mockResolvedValue(savedLicense);
      mockLicenseRepository.update.mockResolvedValue({ affected: 1 });
      mockLicenseStatusHistoryRepository.create.mockReturnValue({
        license_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      });
      mockLicenseStatusHistoryRepository.save.mockResolvedValue({});
      mockWebsocketGateway.emitLicenseStatusUpdate.mockResolvedValue(undefined);

      const result = await service.create(createLicenseDto);

      expect(mockTrackRepository.findOneBy).toHaveBeenCalledWith({
        id: createLicenseDto.track_id,
      });
      expect(mockLicenseRepository.findOneBy).toHaveBeenCalledWith({
        track_id: mockTrack.id,
      });
      expect(mockLicenseRepository.create).toHaveBeenCalledWith({
        track_id: mockTrack.id,
        status_id: LicenseStatusEnum.PENDING,
      });
      expect(mockLicenseRepository.save).toHaveBeenCalled();
      expect(mockLicenseRepository.update).toHaveBeenCalledWith(1, {
        status_id: LicenseStatusEnum.PENDING,
      });
      expect(mockWebsocketGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith(
        1,
        LicenseStatusEnum.PENDING,
        'PENDING',
        1,
      );
      expect(result).toEqual(savedLicense);
    });

    it('should throw I18nException when track is not found', async () => {
      const createLicenseDto: CreateLicenseDto = {
        track_id: 999,
      };

      mockTrackRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('Track not found');

      await expect(service.create(createLicenseDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockLicenseRepository.create).not.toHaveBeenCalled();
    });

    it('should throw I18nException when trying to create PENDING status again', async () => {
      const createLicenseDto: CreateLicenseDto = {
        track_id: 1,
      };

      const mockTrack = {
        id: 1,
        scene_id: 1,
        song_id: 1,
        start_time_seconds: 0,
        end_time_seconds: 30,
        is_deleted: false,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockTrackRepository.findOneBy.mockResolvedValue(mockTrack);
      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockI18nService.t.mockReturnValue('Status already generated');

      await expect(service.create(createLicenseDto)).rejects.toThrow(
        I18nException,
      );
      expect(mockTrackRepository.findOneBy).toHaveBeenCalledWith({
        id: createLicenseDto.track_id,
      });
      expect(mockLicenseRepository.findOneBy).toHaveBeenCalledWith({
        track_id: mockTrack.id,
      });
      expect(mockLicenseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a license by id', async () => {
      const mockLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
        track: { id: 1 },
        status: { id: 1, name: 'PENDING' },
      };

      mockLicenseRepository.findOne.mockResolvedValue(mockLicense);

      const result = await service.findOne(1);

      expect(mockLicenseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['track', 'status'],
      });
      expect(result).toEqual(mockLicense);
    });

    it('should throw I18nException when license is not found', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('License not found');

      await expect(service.findOne(999)).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        relations: ['track', 'status'],
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status from PENDING to IN_NEGOTIATION', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.IN_NEGOTIATION,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockLicenseRepository.update.mockResolvedValue({ affected: 1 });
      mockLicenseStatusHistoryRepository.create.mockReturnValue({
        license_id: 1,
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      });
      mockLicenseStatusHistoryRepository.save.mockResolvedValue({});
      mockWebsocketGateway.emitLicenseStatusUpdate.mockResolvedValue(undefined);

      await service.updateStatus(1, updateLicenseStatusDto);

      expect(mockLicenseRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(mockLicenseRepository.update).toHaveBeenCalledWith(1, {
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      });
      expect(mockWebsocketGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith(
        1,
        LicenseStatusEnum.IN_NEGOTIATION,
        'IN_NEGOTIATION',
        1,
      );
    });

    it('should update status from IN_NEGOTIATION to APPROVED', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockLicenseRepository.update.mockResolvedValue({ affected: 1 });
      mockLicenseStatusHistoryRepository.create.mockReturnValue({
        license_id: 1,
        status_id: LicenseStatusEnum.APPROVED,
      });
      mockLicenseStatusHistoryRepository.save.mockResolvedValue({});
      mockWebsocketGateway.emitLicenseStatusUpdate.mockResolvedValue(undefined);

      await service.updateStatus(1, updateLicenseStatusDto);

      expect(mockLicenseRepository.update).toHaveBeenCalledWith(1, {
        status_id: LicenseStatusEnum.APPROVED,
      });
      expect(mockWebsocketGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith(
        1,
        LicenseStatusEnum.APPROVED,
        'APPROVED',
        1,
      );
    });

    it('should update status from IN_NEGOTIATION to REJECTED', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.REJECTED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockLicenseRepository.update.mockResolvedValue({ affected: 1 });
      mockLicenseStatusHistoryRepository.create.mockReturnValue({
        license_id: 1,
        status_id: LicenseStatusEnum.REJECTED,
      });
      mockLicenseStatusHistoryRepository.save.mockResolvedValue({});
      mockWebsocketGateway.emitLicenseStatusUpdate.mockResolvedValue(undefined);

      await service.updateStatus(1, updateLicenseStatusDto);

      expect(mockLicenseRepository.update).toHaveBeenCalledWith(1, {
        status_id: LicenseStatusEnum.REJECTED,
      });
      expect(mockWebsocketGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith(
        1,
        LicenseStatusEnum.REJECTED,
        'REJECTED',
        1,
      );
    });

    it('should update status from PENDING to CANCELLED', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.CANCELLED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockLicenseRepository.update.mockResolvedValue({ affected: 1 });
      mockLicenseStatusHistoryRepository.create.mockReturnValue({
        license_id: 1,
        status_id: LicenseStatusEnum.CANCELLED,
      });
      mockLicenseStatusHistoryRepository.save.mockResolvedValue({});
      mockWebsocketGateway.emitLicenseStatusUpdate.mockResolvedValue(undefined);

      await service.updateStatus(1, updateLicenseStatusDto);

      expect(mockLicenseRepository.update).toHaveBeenCalledWith(1, {
        status_id: LicenseStatusEnum.CANCELLED,
      });
      expect(mockWebsocketGateway.emitLicenseStatusUpdate).toHaveBeenCalledWith(
        1,
        LicenseStatusEnum.CANCELLED,
        'CANCELLED',
        1,
      );
    });

    it('should throw I18nException when license is not found', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(null);
      mockI18nService.t.mockReturnValue('License not found');

      await expect(
        service.updateStatus(999, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });

    it('should throw I18nException when transition from PENDING to APPROVED is not allowed', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.APPROVED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockI18nService.t.mockReturnValue('Status transition not allowed');

      await expect(
        service.updateStatus(1, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });

    it('should throw I18nException when transition from PENDING to REJECTED is not allowed', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.REJECTED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockI18nService.t.mockReturnValue('Status transition not allowed');

      await expect(
        service.updateStatus(1, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });

    it('should throw I18nException when transition from IN_NEGOTIATION to CANCELLED is not allowed', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.CANCELLED,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockI18nService.t.mockReturnValue('Status transition not allowed');

      await expect(
        service.updateStatus(1, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });

    it('should throw I18nException when trying to set PENDING on existing license', async () => {
      const updateLicenseStatusDto: UpdateLicenseStatusDto = {
        status: LicenseStatusEnum.PENDING,
      };

      const existingLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.IN_NEGOTIATION,
      };

      mockLicenseRepository.findOneBy.mockResolvedValue(existingLicense);
      mockI18nService.t.mockReturnValue('Status already generated');

      await expect(
        service.updateStatus(1, updateLicenseStatusDto),
      ).rejects.toThrow(I18nException);
      expect(mockLicenseRepository.update).not.toHaveBeenCalled();
    });
  });
});
