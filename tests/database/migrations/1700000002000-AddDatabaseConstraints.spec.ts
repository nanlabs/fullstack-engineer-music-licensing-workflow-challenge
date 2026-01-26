import { AddDatabaseConstraints1700000002000 } from '../../../src/database/migrations/1700000002000-AddDatabaseConstraints';
import { QueryRunner } from 'typeorm';

describe('AddDatabaseConstraints1700000002000', () => {
  let migration: AddDatabaseConstraints1700000002000;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new AddDatabaseConstraints1700000002000();
    mockQueryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  it('should be defined', () => {
    expect(migration).toBeDefined();
  });

  it('should have correct name', () => {
    expect(migration.name).toBe('AddDatabaseConstraints1700000002000');
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
