import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScenesModule } from '../scenes/scenes.module';
import { SongsModule } from '../songs/songs.module';
import { TracksController } from './controllers/tracks.controller';
import { Track } from './entities/track.entity';
import { TracksRepository } from './repositories/tracks.repository';
import { TracksResolver } from './resolvers/tracks.resolver';
import { TracksService } from './services/tracks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Track]), ScenesModule, forwardRef(() => SongsModule)],
  controllers: [TracksController],
  providers: [TracksService, TracksRepository, TracksResolver],
  exports: [TracksService],
})
export class TracksModule {}
