import { Cache } from '@nestjs/cache-manager';
import type { RedisClientType } from '@redis/client';

export const cacheRemover = async (cacheKey: string, cacheManager: Cache) => {
  const cache = await cacheManager.get(cacheKey);
  if (cache) {
    await cacheManager.del(cacheKey);
  }
};

export const deleteCacheByPattern = async (
  pattern: string,
  redisClient: RedisClientType | null,
  cacheManager: Cache,
): Promise<void> => {
  // Keyv adds a 'keyv:' prefix to all keys in Redis, so we need to check with prefix
  const keyvPattern = pattern.startsWith('keyv:') ? pattern : `keyv:${pattern}`;

  // Try to delete from Redis using SCAN if client is available
  if (redisClient) {
    try {
      const keys: string[] = [];
      let cursor = '0';

      // Scan with the keyv: prefix pattern
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: keyvPattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');

      // Also try the pattern without keyv: prefix (just in case)
      if (!pattern.startsWith('keyv:')) {
        cursor = '0';
        do {
          const result = await redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          cursor = result.cursor;
          keys.push(...result.keys);
        } while (cursor !== '0');
      }

      console.log('keys', keys);
      console.log('keyvPattern', keyvPattern);
      console.log('pattern', pattern);

      // Remove duplicates and delete all matching keys from Redis
      const uniqueKeys = [...new Set(keys)];
      if (uniqueKeys.length > 0) {
        for (const key of uniqueKeys) {
          await cacheManager.del(key);
        }
      }
    } catch (error) {
      console.warn('Failed to delete cache keys by pattern from Redis:', error);
    }
  }

  // Also delete known keys through cache manager to clear in-memory cache
  // The cache manager handles multi-tier deletion automatically
  try {
    // Extract base pattern and try deleting common variations
    const basePattern = pattern.replace('*', '');

    // Try deleting the base key (cache manager will handle multi-tier)
    await cacheManager.del(basePattern);

    // For patterns like "movies:page:1*", try deleting without wildcard
    // This helps clear in-memory cache even if pattern doesn't match exactly
    if (pattern.includes('*')) {
      const baseKey = pattern.split('*')[0].replace(/[:]$/, '');
      if (baseKey) {
        await cacheManager.del(baseKey);
      }
    }
  } catch (error) {
    console.warn('Failed to delete cache keys through cache manager:', error);
  }
};
