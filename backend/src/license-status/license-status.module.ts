import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicenseStatus } from '../entities/license-status.entity';
import { LicenseStatusService } from './license-status.service';
import { LicenseStatusController } from './license-status.controller';
import { LicenseStatusGateway } from './license-status.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([LicenseStatus])],
  providers: [LicenseStatusService, LicenseStatusGateway],
  controllers: [LicenseStatusController],
})
export class LicenseStatusModule {}
