import { Test, TestingModule } from '@nestjs/testing';
import { LicenseStatusService } from './license-status.service';

describe('LicenseStatusService', () => {
  let service: LicenseStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LicenseStatusService],
    }).compile();

    service = module.get<LicenseStatusService>(LicenseStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
