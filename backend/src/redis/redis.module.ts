import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_PUBLISHER',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        });
      },
    },
    {
      provide: 'REDIS_SUBSCRIBER',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        });
      },
    },
  ],
  exports: ['REDIS_PUBLISHER', 'REDIS_SUBSCRIBER'],
})
export class RedisModule {}
