import { DatabaseModule } from '../../src/database/database.module';

describe('DatabaseModule', () => {
  it('should be defined', () => {
    expect(DatabaseModule).toBeDefined();
  });

  it('should be a class', () => {
    expect(typeof DatabaseModule).toBe('function');
  });

  it('should be importable', () => {
    expect(() => {
      const module = new DatabaseModule();
      expect(module).toBeDefined();
    }).not.toThrow();
  });
});
