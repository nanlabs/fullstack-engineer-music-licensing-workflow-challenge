import databaseConfig from '../../src/config/database.config';

describe('DatabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no env vars are set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.NODE_ENV;
    delete process.env.DB_SYNC;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_POOL_MIN;
    delete process.env.DB_POOL_IDLE_TIMEOUT;
    delete process.env.DB_POOL_CONNECTION_TIMEOUT;

    const config = databaseConfig();

    expect(config.type).toBe('postgres');
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('postgres');
    expect(config.password).toBe('postgres');
    expect(config.database).toBe('acme_bros_db');
    expect(config.synchronize).toBe(false);
    expect(config.logging).toBe(false);
    expect(config.extra.max).toBe(20);
    expect(config.extra.min).toBe(5);
    expect(config.extra.idleTimeoutMillis).toBe(30000);
    expect(config.extra.connectionTimeoutMillis).toBe(2000);
  });

  it('should use environment variables when set', () => {
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'testuser';
    process.env.DB_PASSWORD = 'testpass';
    process.env.DB_NAME = 'testdb';
    process.env.DB_POOL_MAX = '50';
    process.env.DB_POOL_MIN = '10';
    process.env.DB_POOL_IDLE_TIMEOUT = '60000';
    process.env.DB_POOL_CONNECTION_TIMEOUT = '5000';

    const config = databaseConfig();

    expect(config.host).toBe('db.example.com');
    expect(config.port).toBe(5433);
    expect(config.username).toBe('testuser');
    expect(config.password).toBe('testpass');
    expect(config.database).toBe('testdb');
    expect(config.extra.max).toBe(50);
    expect(config.extra.min).toBe(10);
    expect(config.extra.idleTimeoutMillis).toBe(60000);
    expect(config.extra.connectionTimeoutMillis).toBe(5000);
  });

  it('should enable synchronize when NODE_ENV is development and DB_SYNC is true', () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_SYNC = 'true';

    const config = databaseConfig();

    expect(config.synchronize).toBe(true);
  });

  it('should disable synchronize when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_SYNC = 'true';

    const config = databaseConfig();

    expect(config.synchronize).toBe(false);
  });

  it('should disable synchronize when DB_SYNC is not true', () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_SYNC = 'false';

    const config = databaseConfig();

    expect(config.synchronize).toBe(false);
  });

  it('should enable logging when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';

    const config = databaseConfig();

    expect(config.logging).toBe(true);
  });

  it('should disable logging when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';

    const config = databaseConfig();

    expect(config.logging).toBe(false);
  });
});
