import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from '../../entities';
import { LicensesService } from './licenses.service';
import { LicensesRepository } from './licenses.repository';
import { LicensesController } from './licenses.controller';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import { TracksModule } from '../tracks/tracks.module';

@Module({
  imports: [TypeOrmModule.forFeature([License]), TracksModule],
  controllers: [LicensesController],
  providers: [LicensesRepository, LicensesService, LicensesUpdatesGateway],
  exports: [LicensesService],
})
export class LicensesModule {}
