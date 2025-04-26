import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from '../entities/track.entity';
import { Song } from '../entities/song.entity';
import { Scene } from '../entities/scene.entity';
import { LicenseStatus } from '../entities/license-status.entity';
import { TrackService } from './track.service';
import { TrackController } from './track.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Track, Song, Scene, LicenseStatus])],
  providers: [TrackService],
  controllers: [TrackController],
})
export class TrackModule {}
