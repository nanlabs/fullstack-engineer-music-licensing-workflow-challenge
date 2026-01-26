import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthService } from '../../src/health/health.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: DataSource;

  const mockDataSource = {
    query: jest.fn(),
    driver: {
      master: {
        pool: {
          totalCount: 10,
          idleCount: 5,
          waitingCount: 0,
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when database is connected', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.status).toBe('healthy');
      expect(result.database).toBe('connected');
      expect(result.pool).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database is disconnected', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

      const result = await service.check();

      expect(result.status).toBe('unhealthy');
      expect(result.database).toBe('disconnected');
    });

    it('should include pool status when available', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.pool).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      });
    });

    it('should handle missing pool gracefully', async () => {
      const dataSourceWithoutPool = {
        query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        driver: {},
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HealthService,
          {
            provide: getDataSourceToken(),
            useValue: dataSourceWithoutPool,
          },
        ],
      }).compile();

      const serviceWithoutPool = module.get<HealthService>(HealthService);
      const result = await serviceWithoutPool.check();

      expect(result.pool).toBeNull();
    });
  });

  describe('checkDatabase', () => {
    it('should return true when database query succeeds', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      // Access private method via reflection or make it public for testing
      const result = await (service as any).checkDatabase();

      expect(result).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when database query fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection error'));

      const result = await (service as any).checkDatabase();

      expect(result).toBe(false);
    });
  });

  describe('getPoolStatus', () => {
    it('should return pool status when pool exists', () => {
      const result = (service as any).getPoolStatus();

      expect(result).toEqual({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      });
    });

    it('should return null when pool does not exist', async () => {
      const dataSourceWithoutPool = {
        driver: {},
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HealthService,
          {
            provide: getDataSourceToken(),
            useValue: dataSourceWithoutPool,
          },
        ],
      }).compile();

      const serviceWithoutPool = module.get<HealthService>(HealthService);
      const result = (serviceWithoutPool as any).getPoolStatus();
      expect(result).toBeNull();
    });
  });
});
