import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TracksService } from './tracks.service';
import { TracksController } from './tracks.controller';
import { Track } from '../entities/track.entity';
import { LicensingStatus } from '../entities/licensing-status.entity';
import { Scene } from '../entities/scene.entity';
import { Song } from '../entities/song.entity';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Track, LicensingStatus, Scene, Song]),
    RealtimeModule,
  ],
  controllers: [TracksController],
  providers: [TracksService],
  exports: [TracksService],
})
export class TracksModule {}
