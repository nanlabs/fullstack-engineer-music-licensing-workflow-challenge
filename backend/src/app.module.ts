import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviesModule } from './movies/movies.module';
import { ScenesModule } from './scenes/scenes.module';
import { SongsModule } from './songs/songs.module';
import { TracksModule } from './tracks/tracks.module';
import { envs } from 'config/envs';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: envs.dbHost,
        port: envs.dbPort,
        username: envs.dbUser,
        password: envs.dbPassword,
        database: envs.dbName,
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    MoviesModule,
    ScenesModule,
    SongsModule,
    TracksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
