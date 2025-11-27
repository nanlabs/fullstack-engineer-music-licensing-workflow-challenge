import { Module } from '@nestjs/common';
import { LicensingGateway } from './licensing.gateway';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [LicensingGateway],
  exports: [LicensingGateway],
})
export class LicensingModule {}
