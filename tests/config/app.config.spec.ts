import appConfig from '../../src/config/app.config';

describe('AppConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no env vars are set', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.API_PREFIX;
    delete process.env.CORS_ENABLED;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.SSE_HEARTBEAT_INTERVAL;
    delete process.env.SSE_MAX_CONNECTIONS;
    delete process.env.REQUEST_TIMEOUT;
    delete process.env.REQUEST_BODY_SIZE_LIMIT;
    delete process.env.PAGINATION_DEFAULT_PAGE;
    delete process.env.PAGINATION_DEFAULT_LIMIT;
    delete process.env.PAGINATION_MAX_LIMIT;
    delete process.env.HEALTH_CHECK_MEMORY_HEAP_THRESHOLD;
    delete process.env.HEALTH_CHECK_MEMORY_RSS_THRESHOLD;
    delete process.env.HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD;
    delete process.env.HEALTH_CHECK_DISK_THRESHOLD_PERCENT;
    delete process.env.TRANSFORM_INTERCEPTOR_SKIP_PATHS;
    delete process.env.TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES;

    const config = appConfig();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.apiPrefix).toBe('api');
    expect(config.corsEnabled).toBe(true);
    expect(config.allowedOrigins).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(config.rateLimitTtl).toBe(60000);
    expect(config.rateLimitMax).toBe(100);
    expect(config.sseHeartbeatInterval).toBe(30000);
    expect(config.sseMaxConnections).toBe(1000);
    expect(config.requestTimeout).toBe(30000);
    expect(config.requestBodySizeLimit).toBe('10mb');
    expect(config.pagination.defaultPage).toBe(1);
    expect(config.pagination.defaultLimit).toBe(10);
    expect(config.pagination.maxLimit).toBe(100);
    expect(config.healthCheck.memoryHeapThreshold).toBe(157286400);
    expect(config.healthCheck.memoryRssThreshold).toBe(157286400);
    expect(config.healthCheck.livenessMemoryThreshold).toBe(314572800);
    expect(config.healthCheck.diskThresholdPercent).toBe(0.9);
    expect(config.transformInterceptor.skipPaths).toEqual(['/health', '/docs']);
    expect(config.transformInterceptor.skipStatusCodes).toEqual([204]);
  });

  it('should use environment variables when set', () => {
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'production';
    process.env.API_PREFIX = 'v1';
    process.env.CORS_ENABLED = 'false';
    process.env.ALLOWED_ORIGINS = 'http://example.com,http://test.com';
    process.env.RATE_LIMIT_TTL = '120000';
    process.env.RATE_LIMIT_MAX = '200';
    process.env.SSE_HEARTBEAT_INTERVAL = '60000';
    process.env.SSE_MAX_CONNECTIONS = '2000';
    process.env.REQUEST_TIMEOUT = '60000';
    process.env.REQUEST_BODY_SIZE_LIMIT = '20mb';
    process.env.PAGINATION_DEFAULT_PAGE = '2';
    process.env.PAGINATION_DEFAULT_LIMIT = '20';
    process.env.PAGINATION_MAX_LIMIT = '200';
    process.env.HEALTH_CHECK_MEMORY_HEAP_THRESHOLD = '200000000';
    process.env.HEALTH_CHECK_MEMORY_RSS_THRESHOLD = '200000000';
    process.env.HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD = '400000000';
    process.env.HEALTH_CHECK_DISK_THRESHOLD_PERCENT = '0.8';
    process.env.TRANSFORM_INTERCEPTOR_SKIP_PATHS = '/api,/health';
    process.env.TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES = '204,304';

    const config = appConfig();

    expect(config.port).toBe(8080);
    expect(config.nodeEnv).toBe('production');
    expect(config.apiPrefix).toBe('v1');
    expect(config.corsEnabled).toBe(false);
    expect(config.allowedOrigins).toEqual([
      'http://example.com',
      'http://test.com',
    ]);
    expect(config.rateLimitTtl).toBe(120000);
    expect(config.rateLimitMax).toBe(200);
    expect(config.sseHeartbeatInterval).toBe(60000);
    expect(config.sseMaxConnections).toBe(2000);
    expect(config.requestTimeout).toBe(60000);
    expect(config.requestBodySizeLimit).toBe('20mb');
    expect(config.pagination.defaultPage).toBe(2);
    expect(config.pagination.defaultLimit).toBe(20);
    expect(config.pagination.maxLimit).toBe(200);
    expect(config.healthCheck.memoryHeapThreshold).toBe(200000000);
    expect(config.healthCheck.memoryRssThreshold).toBe(200000000);
    expect(config.healthCheck.livenessMemoryThreshold).toBe(400000000);
    expect(config.healthCheck.diskThresholdPercent).toBe(0.8);
    expect(config.transformInterceptor.skipPaths).toEqual(['/api', '/health']);
    expect(config.transformInterceptor.skipStatusCodes).toEqual([204, 304]);
  });

  it('should handle CORS_ENABLED being explicitly false', () => {
    process.env.CORS_ENABLED = 'false';
    const config = appConfig();
    expect(config.corsEnabled).toBe(false);
  });

  it('should handle CORS_ENABLED being true', () => {
    process.env.CORS_ENABLED = 'true';
    const config = appConfig();
    expect(config.corsEnabled).toBe(true);
  });

  it('should handle CORS_ENABLED being unset (defaults to true)', () => {
    delete process.env.CORS_ENABLED;
    const config = appConfig();
    expect(config.corsEnabled).toBe(true);
  });
});
