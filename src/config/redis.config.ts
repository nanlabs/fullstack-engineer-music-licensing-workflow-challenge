import { Global, Module, Provider } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';
import { createClient } from '@redis/client';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const RedisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: async () => {
    if (!process.env.REDIS_URL) {
      return null;
    }

    try {
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      return client;
    } catch (error) {
      // If Redis connection fails, return null to allow app to continue
      console.warn('Failed to connect to Redis:', error);
      return null;
    }
  },
};

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 60000, lruSize: 1000 }),
            }),
            new KeyvRedis(process.env.REDIS_URL),
          ],
        };
      },
    }),
  ],
  providers: [RedisClientProvider],
  exports: [CacheModule, REDIS_CLIENT],
})
export class RedisConfigModule {}
