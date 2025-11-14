import { Module } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from './entities/track.entity';
import { Scene } from 'src/scenes/entities/scene.entity';
import { Song } from 'src/songs/entities/song.entity';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Track, Scene, Song]), RealtimeModule],
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}
