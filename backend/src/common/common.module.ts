import { Module, Global } from '@nestjs/common';
import { LicenseUpdateGateway } from './gateways/license-update.gateway';

@Global()
@Module({
  providers: [LicenseUpdateGateway],
  exports: [LicenseUpdateGateway],
})
export class CommonModule {}
