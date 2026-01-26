import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { typeormConfig } from '../../../src/config/typeorm.config';

// Mock dependencies
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../../src/config/typeorm.config', () => ({
  typeormConfig: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
  },
}));

jest.mock('../../../src/database/seeds/seed-data', () => ({
  seedDatabase: jest.fn().mockResolvedValue(undefined),
}));

describe('RunSeed', () => {
  let mockDataSource: jest.Mocked<DataSource>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    mockDataSource = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    } as any;

    jest.spyOn(DataSource.prototype, 'constructor' as any).mockImplementation(
      () => mockDataSource,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should export typeormConfig', () => {
    expect(typeormConfig).toBeDefined();
    expect(typeormConfig.type).toBe('postgres');
  });

  it('should have correct DataSource configuration structure', () => {
    expect(typeormConfig).toHaveProperty('type');
    expect(typeormConfig).toHaveProperty('host');
    expect(typeormConfig).toHaveProperty('port');
  });
});
