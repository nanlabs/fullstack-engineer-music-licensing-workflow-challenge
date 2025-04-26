import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entities/movie.entity';
import { Scene } from './entities/scene.entity';
import { Track } from './entities/track.entity';
import { Song } from './entities/song.entity';
import { LicenseStatus } from './entities/license-status.entity';
import { MovieModule } from './movie/movie.module';
import { SceneModule } from './scene/scene.module';
import { TrackModule } from './track/track.module';
import { LicenseStatusModule } from './license-status/license-status.module';
import { SongModule } from './song/song.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'acme',
      synchronize: true,
      autoLoadEntities: true,
      entities: [Movie, Scene, Track, Song, LicenseStatus],
    }),
    MovieModule,
    SceneModule,
    TrackModule,
    LicenseStatusModule,
    SongModule,
  ],
})
export class AppModule {}
