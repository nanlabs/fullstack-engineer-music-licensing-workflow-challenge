import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api',
  corsEnabled: process.env.CORS_ENABLED !== 'false',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  sseHeartbeatInterval: parseInt(
    process.env.SSE_HEARTBEAT_INTERVAL || '30000',
    10,
  ),
  sseMaxConnections: parseInt(process.env.SSE_MAX_CONNECTIONS || '1000', 10),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  requestBodySizeLimit: process.env.REQUEST_BODY_SIZE_LIMIT || '10mb',
  pagination: {
    defaultPage: parseInt(process.env.PAGINATION_DEFAULT_PAGE || '1', 10),
    defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT || '10', 10),
    maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT || '100', 10),
  },
  healthCheck: {
    memoryHeapThreshold: parseInt(
      process.env.HEALTH_CHECK_MEMORY_HEAP_THRESHOLD || '157286400',
      10,
    ), // 150MB in bytes
    memoryRssThreshold: parseInt(
      process.env.HEALTH_CHECK_MEMORY_RSS_THRESHOLD || '157286400',
      10,
    ), // 150MB in bytes
    livenessMemoryThreshold: parseInt(
      process.env.HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD || '314572800',
      10,
    ), // 300MB in bytes
    diskThresholdPercent: parseFloat(
      process.env.HEALTH_CHECK_DISK_THRESHOLD_PERCENT || '0.9',
    ), // 90%
  },
  transformInterceptor: {
    skipPaths: process.env.TRANSFORM_INTERCEPTOR_SKIP_PATHS
      ? process.env.TRANSFORM_INTERCEPTOR_SKIP_PATHS.split(',')
      : ['/health', '/docs'],
    skipStatusCodes: process.env.TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES
      ? process.env.TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES.split(',').map(
          code => parseInt(code, 10),
        )
      : [204],
  },
}));
