import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/movies/entities/movie.entity';
import { Scene } from 'src/scenes/entities/scene.entity';
import { Song } from 'src/songs/entities/song.entity';
import { Track } from 'src/tracks/entities/track.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Movie, Scene, Song, Track])],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
