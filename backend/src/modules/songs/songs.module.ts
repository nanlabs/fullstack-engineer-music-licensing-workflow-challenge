import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensesModule } from '../licenses/licenses.module';
import { SongsController } from './controllers/songs.controller';
import { Song } from './entities/song.entity';
import { SongsRepository } from './repositories/songs.repository';
import { SongsResolver } from './resolvers/songs.resolver';
import { SongsService } from './services/songs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Song]), forwardRef(() => LicensesModule)],
  controllers: [SongsController],
  providers: [SongsService, SongsRepository, SongsResolver],
  exports: [SongsService],
})
export class SongsModule {}
