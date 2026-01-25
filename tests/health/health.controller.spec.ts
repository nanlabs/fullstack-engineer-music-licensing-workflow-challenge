import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let dbIndicator: TypeOrmHealthIndicator;
  let memoryIndicator: MemoryHealthIndicator;
  let diskIndicator: DiskHealthIndicator;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockDbIndicator = {
    pingCheck: jest.fn(),
  };

  const mockMemoryIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };

  const mockDiskIndicator = {
    checkStorage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockDbIndicator,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryIndicator,
        },
        {
          provide: DiskHealthIndicator,
          useValue: mockDiskIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    dbIndicator = module.get<TypeOrmHealthIndicator>(TypeOrmHealthIndicator);
    memoryIndicator =
      module.get<MemoryHealthIndicator>(MemoryHealthIndicator);
    diskIndicator = module.get<DiskHealthIndicator>(DiskHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should check overall health', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockDbIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      mockMemoryIndicator.checkHeap.mockResolvedValue({ memory_heap: { status: 'up' } });
      mockMemoryIndicator.checkRSS.mockResolvedValue({ memory_rss: { status: 'up' } });
      mockDiskIndicator.checkStorage.mockResolvedValue({ storage: { status: 'up' } });

      const result = await controller.check();

      expect(healthCheckService.check).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('checkDatabase', () => {
    it('should check database health', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockDbIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });

      const result = await controller.checkDatabase();

      expect(healthCheckService.check).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('checkReady', () => {
    it('should check readiness', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockDbIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });

      const result = await controller.checkReady();

      expect(healthCheckService.check).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('checkLive', () => {
    it('should check liveness', async () => {
      const mockResult = {
        status: 'ok',
        info: {
          memory_heap: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockMemoryIndicator.checkHeap.mockResolvedValue({ memory_heap: { status: 'up' } });

      const result = await controller.checkLive();

      expect(healthCheckService.check).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });
});
