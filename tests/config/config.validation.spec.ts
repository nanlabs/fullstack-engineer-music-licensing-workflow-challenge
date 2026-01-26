import * as Joi from 'joi';
import { configValidationSchema } from '../../src/config/config.validation';

describe('ConfigValidationSchema', () => {
  it('should validate correct environment variables', () => {
    const validEnv = {
      NODE_ENV: 'production',
      PORT: 3000,
      API_PREFIX: 'api',
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
      DB_SYNC: false,
      DB_POOL_MAX: 20,
      DB_POOL_MIN: 5,
      DB_POOL_IDLE_TIMEOUT: 30000,
      DB_POOL_CONNECTION_TIMEOUT: 2000,
      CORS_ENABLED: true,
      ALLOWED_ORIGINS: 'http://localhost:3000',
      RATE_LIMIT_TTL: 60000,
      RATE_LIMIT_MAX: 100,
      PAGINATION_DEFAULT_PAGE: 1,
      PAGINATION_DEFAULT_LIMIT: 10,
      PAGINATION_MAX_LIMIT: 100,
      HEALTH_CHECK_MEMORY_HEAP_THRESHOLD: 157286400,
      HEALTH_CHECK_MEMORY_RSS_THRESHOLD: 157286400,
      HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD: 314572800,
      HEALTH_CHECK_DISK_THRESHOLD_PERCENT: 0.9,
      SSE_HEARTBEAT_INTERVAL: 30000,
      SSE_MAX_CONNECTIONS: 1000,
      REQUEST_TIMEOUT: 30000,
      REQUEST_BODY_SIZE_LIMIT: '10mb',
      TRANSFORM_INTERCEPTOR_SKIP_PATHS: '/health',
      TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES: '204',
    };

    const { error } = configValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('should use default values when variables are missing', () => {
    const envWithDefaults = {
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
    };

    const { value, error } = configValidationSchema.validate(envWithDefaults);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api');
    expect(value.DB_HOST).toBe('localhost');
    expect(value.DB_PORT).toBe(5432);
    expect(value.DB_SYNC).toBe(false);
    expect(value.CORS_ENABLED).toBe(true);
  });

  it('should reject invalid NODE_ENV', () => {
    const invalidEnv = {
      NODE_ENV: 'invalid',
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
    };

    const { error } = configValidationSchema.validate(invalidEnv);
    expect(error).toBeDefined();
    expect(error?.details[0].path).toContain('NODE_ENV');
  });

  it('should reject invalid PORT', () => {
    const invalidEnv = {
      PORT: 99999, // Invalid port number
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
    };

    const { error } = configValidationSchema.validate(invalidEnv);
    expect(error).toBeDefined();
    expect(error?.details[0].path).toContain('PORT');
  });

  it('should reject missing required DB fields', () => {
    const invalidEnv = {
      // Missing DB_USERNAME, DB_PASSWORD, DB_NAME
    };

    const { error } = configValidationSchema.validate(invalidEnv, {
      abortEarly: false,
    });
    expect(error).toBeDefined();
    const errorPaths = error?.details.map(d => d.path.join('.'));
    expect(errorPaths?.some(path => path.includes('DB_USERNAME'))).toBe(true);
    expect(errorPaths?.some(path => path.includes('DB_PASSWORD'))).toBe(true);
    expect(errorPaths?.some(path => path.includes('DB_NAME'))).toBe(true);
  });

  it('should validate optional fields', () => {
    const envWithOptionals = {
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
      ALLOWED_ORIGINS: 'http://example.com,http://test.com',
      TRANSFORM_INTERCEPTOR_SKIP_PATHS: '/api,/health',
      TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES: '204,304',
    };

    const { error } = configValidationSchema.validate(envWithOptionals);
    expect(error).toBeUndefined();
  });

  it('should validate numeric constraints', () => {
    const invalidEnv = {
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'database',
      DB_POOL_MAX: 0, // Should be min 1
      HEALTH_CHECK_MEMORY_HEAP_THRESHOLD: 1000, // Should be min 1048576
      HEALTH_CHECK_DISK_THRESHOLD_PERCENT: 1.5, // Should be max 1
    };

    const { error } = configValidationSchema.validate(invalidEnv);
    expect(error).toBeDefined();
  });
});
