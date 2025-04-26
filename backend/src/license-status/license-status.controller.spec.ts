import { Test, TestingModule } from '@nestjs/testing';
import { LicenseStatusController } from './license-status.controller';

describe('LicenseStatusController', () => {
  let controller: LicenseStatusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicenseStatusController],
    }).compile();

    controller = module.get<LicenseStatusController>(LicenseStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
