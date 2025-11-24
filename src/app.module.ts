import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Movie, Scene, Track, Song, License } from './entities';
import { MoviesModule } from './modules/movies/movies.module';
import { ScenesModule } from './modules/scenes/scenes.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { SongsModule } from './modules/songs/songs.module';
import { LicensesModule } from './modules/licenses/licenses.module';

@Module({
  imports: [
    //Como es a modo de prueba/desarrollo local y facilitar las pruebas, dejamos valores hardcodeados si no encuentra del .env.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'music_licensing',
      entities: [Movie, Scene, Track, Song, License],
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature([Movie, Scene, Track, Song, License]),
    MoviesModule,
    ScenesModule,
    TracksModule,
    SongsModule,
    LicensesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
