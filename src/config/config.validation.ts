import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables
 * Validates required and optional configuration values
 */
export const configValidationSchema = Joi.object({
  // Application Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),

  // Database Configuration
  DB_HOST: Joi.string().hostname().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNC: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(20),
  DB_POOL_MIN: Joi.number().integer().min(1).default(5),
  DB_POOL_IDLE_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT: Joi.number().integer().min(1000).default(2000),

  // CORS Configuration
  CORS_ENABLED: Joi.boolean().default(true),
  ALLOWED_ORIGINS: Joi.string().optional(),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),

  // Pagination
  PAGINATION_DEFAULT_PAGE: Joi.number().integer().min(1).default(1),
  PAGINATION_DEFAULT_LIMIT: Joi.number().integer().min(1).default(10),
  PAGINATION_MAX_LIMIT: Joi.number().integer().min(1).default(100),

  // Health Check
  HEALTH_CHECK_MEMORY_HEAP_THRESHOLD: Joi.number()
    .integer()
    .min(1048576)
    .default(157286400),
  HEALTH_CHECK_MEMORY_RSS_THRESHOLD: Joi.number()
    .integer()
    .min(1048576)
    .default(157286400),
  HEALTH_CHECK_LIVENESS_MEMORY_THRESHOLD: Joi.number()
    .integer()
    .min(1048576)
    .default(314572800),
  HEALTH_CHECK_DISK_THRESHOLD_PERCENT: Joi.number().min(0).max(1).default(0.9),

  // SSE Configuration
  SSE_HEARTBEAT_INTERVAL: Joi.number().integer().min(1000).default(30000),
  SSE_MAX_CONNECTIONS: Joi.number().integer().min(1).default(1000),

  // Request Configuration
  REQUEST_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  REQUEST_BODY_SIZE_LIMIT: Joi.string().default('10mb'),

  // Transform Interceptor
  TRANSFORM_INTERCEPTOR_SKIP_PATHS: Joi.string().optional(),
  TRANSFORM_INTERCEPTOR_SKIP_STATUS_CODES: Joi.string().optional(),
});
