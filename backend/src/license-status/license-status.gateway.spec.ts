import { Test, TestingModule } from '@nestjs/testing';
import { LicenseStatusGateway } from './license-status.gateway';

describe('LicenseStatusGateway', () => {
  let gateway: LicenseStatusGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LicenseStatusGateway],
    }).compile();

    gateway = module.get<LicenseStatusGateway>(LicenseStatusGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
