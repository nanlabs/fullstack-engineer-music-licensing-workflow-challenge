import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from '../../entities';
import { LicensesService } from './licenses.service';
import { LicensesRepository } from './licenses.repository';
import { LicensesController } from './licenses.controller';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([License])],
  controllers: [LicensesController],
  providers: [LicensesRepository, LicensesService, LicensesUpdatesGateway],
  exports: [LicensesService],
})
export class LicensesModule {}
