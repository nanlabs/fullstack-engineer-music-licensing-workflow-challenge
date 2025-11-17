import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service';
import { TracksController } from './tracks.controller';
import { LicensesModule } from '../licenses/licenses.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Track } from './entities/track.entity';
import { Song } from '../songs/entities/song.entity';
import { Scene } from '../scenes/entities/scene.entity';
import { License } from '../licenses/entities/license.entity';
import { Movie } from '../movies/entities/movie.entity';

@Module({
  imports: [
    LicensesModule,
    TypeOrmModule.forFeature([Track, Song, Scene, License, Movie]),
  ],
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}
