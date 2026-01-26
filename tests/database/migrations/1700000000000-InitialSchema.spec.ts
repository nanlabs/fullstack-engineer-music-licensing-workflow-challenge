import { InitialSchema1700000000000 } from '../../../src/database/migrations/1700000000000-InitialSchema';
import { QueryRunner } from 'typeorm';

describe('InitialSchema1700000000000', () => {
  let migration: InitialSchema1700000000000;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new InitialSchema1700000000000();
    mockQueryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  it('should be defined', () => {
    expect(migration).toBeDefined();
  });

  it('should have correct name', () => {
    expect(migration.name).toBe('InitialSchema1700000000000');
  });

  it('should run up migration', async () => {
    await migration.up(mockQueryRunner);

    expect(mockQueryRunner.query).toHaveBeenCalled();
    expect(mockQueryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE EXTENSION'),
    );
  });

  it('should run down migration', async () => {
    await migration.down(mockQueryRunner);

    expect(mockQueryRunner.query).toHaveBeenCalled();
  });
});
