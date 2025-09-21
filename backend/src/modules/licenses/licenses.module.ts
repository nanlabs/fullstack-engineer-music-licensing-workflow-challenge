import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Song } from '../songs/entities/song.entity';
import { SongsModule } from '../songs/songs.module';
import { TracksModule } from '../tracks/tracks.module';
import { LicensesController } from './controllers/licenses.controller';
import { LicenseStatus } from './entities/license-status.entity';
import { LicensesRepository } from './repositories/licenses.repository';
import { LicensesResolver } from './resolvers/licenses.resolver';
import { LicensesService } from './services/licenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LicenseStatus, Song]),
    forwardRef(() => SongsModule),
    forwardRef(() => TracksModule),
  ],
  controllers: [LicensesController],
  providers: [LicensesService, LicensesRepository, LicensesResolver], // LicenseUpdateGateway temporarily removed
  exports: [LicensesService], // LicenseUpdateGateway temporarily removed
})
export class LicensesModule {}
