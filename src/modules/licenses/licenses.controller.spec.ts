/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { LicenseStatusEnum } from './entities/license.status.enum';

describe('LicensesController', () => {
  let controller: LicensesController;
  let service: LicensesService;

  const mockLicensesService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicensesController],
      providers: [
        {
          provide: LicensesService,
          useValue: mockLicensesService,
        },
      ],
    }).compile();

    controller = module.get<LicensesController>(LicensesController);
    service = module.get<LicensesService>(LicensesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a license by id', async () => {
      const mockLicense = {
        id: 1,
        track_id: 1,
        status_id: LicenseStatusEnum.PENDING,
      };

      mockLicensesService.findOne.mockResolvedValue(mockLicense);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockLicense);
    });

    it('should convert string id to number', async () => {
      const mockLicense = {
        id: 123,
        track_id: 1,
        status_id: LicenseStatusEnum.APPROVED,
      };

      mockLicensesService.findOne.mockResolvedValue(mockLicense);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockLicense);
    });

    it('should return license with different statuses', async () => {
      const statuses = [
        LicenseStatusEnum.PENDING,
        LicenseStatusEnum.IN_NEGOTIATION,
        LicenseStatusEnum.APPROVED,
        LicenseStatusEnum.REJECTED,
        LicenseStatusEnum.CANCELLED,
      ];

      for (const status of statuses) {
        const mockLicense = {
          id: 1,
          track_id: 1,
          status_id: status,
        };

        mockLicensesService.findOne.mockResolvedValue(mockLicense);

        const result = await controller.findOne('1');

        expect(service.findOne).toHaveBeenCalledWith(1);
        expect(result.status_id).toBe(status);
      }

      expect(mockLicensesService.findOne).toHaveBeenCalledTimes(5);
    });
  });
});
