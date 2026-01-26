import { AddPerformanceIndexes1700000001000 } from '../../../src/database/migrations/1700000001000-AddPerformanceIndexes';
import { QueryRunner } from 'typeorm';

describe('AddPerformanceIndexes1700000001000', () => {
  let migration: AddPerformanceIndexes1700000001000;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new AddPerformanceIndexes1700000001000();
    mockQueryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  it('should be defined', () => {
    expect(migration).toBeDefined();
  });

  it('should have correct name', () => {
    expect(migration.name).toBe('AddPerformanceIndexes1700000001000');
  });

  it('should run up migration', async () => {
    await migration.up(mockQueryRunner);

    expect(mockQueryRunner.query).toHaveBeenCalled();
  });

  it('should run down migration', async () => {
    await migration.down(mockQueryRunner);

    expect(mockQueryRunner.query).toHaveBeenCalled();
  });
});
