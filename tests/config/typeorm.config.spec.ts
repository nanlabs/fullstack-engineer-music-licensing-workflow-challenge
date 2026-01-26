import typeormConfig, { typeormConfig as config } from '../../src/config/typeorm.config';
import { DataSource } from 'typeorm';

describe('TypeORMConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should export a DataSource instance', () => {
    expect(typeormConfig).toBeInstanceOf(DataSource);
  });

  it('should export typeormConfig object', () => {
    expect(config).toBeDefined();
    expect(config.type).toBe('postgres');
  });

  it('should have default configuration values', () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.NODE_ENV;

    // Re-import to get fresh config
    jest.resetModules();
    const freshConfig = require('../../src/config/typeorm.config').typeormConfig;

    expect(freshConfig.host).toBe('localhost');
    expect(freshConfig.port).toBe(5432);
    expect(freshConfig.username).toBe('postgres');
    expect(freshConfig.password).toBe('postgres');
    expect(freshConfig.database).toBe('acme_bros_db');
    expect(freshConfig.synchronize).toBe(false);
    // logging depends on NODE_ENV, which might be set by Jest
    expect(typeof freshConfig.logging).toBe('boolean');

    process.env = originalEnv;
  });

  it('should use environment variables when set', () => {
    process.env.DB_HOST = 'testhost';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'testuser';
    process.env.DB_PASSWORD = 'testpass';
    process.env.DB_NAME = 'testdb';

    jest.resetModules();
    const freshConfig = require('../../src/config/typeorm.config').typeormConfig;

    expect(freshConfig.host).toBe('testhost');
    expect(freshConfig.port).toBe(5433);
    expect(freshConfig.username).toBe('testuser');
    expect(freshConfig.password).toBe('testpass');
    expect(freshConfig.database).toBe('testdb');
  });

  it('should enable logging when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';

    jest.resetModules();
    const freshConfig = require('../../src/config/typeorm.config').typeormConfig;

    expect(freshConfig.logging).toBe(true);
  });

  it('should disable logging when NODE_ENV is not development', () => {
    process.env.NODE_ENV = 'production';

    jest.resetModules();
    const freshConfig = require('../../src/config/typeorm.config').typeormConfig;

    expect(freshConfig.logging).toBe(false);
  });

  it('should have entities and migrations paths configured', () => {
    expect(config.entities).toBeDefined();
    expect(Array.isArray(config.entities)).toBe(true);
    expect(config.migrations).toBeDefined();
    expect(Array.isArray(config.migrations)).toBe(true);
  });
});
