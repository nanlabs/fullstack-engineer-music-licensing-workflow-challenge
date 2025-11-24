import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from '../../entities';
import { TracksService } from './tracks.service';
import { TracksRepository } from './tracks.repository';
import { TracksController } from './tracks.controller';
import { ScenesModule } from '../scenes/scenes.module';
import { SongsModule } from '../songs/songs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Track]), ScenesModule, SongsModule],
  controllers: [TracksController],
  providers: [TracksRepository, TracksService],
  exports: [TracksService, TracksRepository],
})
export class TracksModule {}
