import { Module } from '@nestjs/common';
import { LicensingGateway } from './licensing.gateway';

@Module({
  providers: [LicensingGateway],
  exports: [LicensingGateway],
})
export class RealtimeModule {}
