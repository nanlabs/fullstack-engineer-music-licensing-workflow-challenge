import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { CommonModule } from './common/common.module';
import { LicenseStatus } from './modules/licenses/entities/license-status.entity';
import { LicensesModule } from './modules/licenses/licenses.module';
import { Movie } from './modules/movies/entities/movie.entity';
import { MoviesModule } from './modules/movies/movies.module';
import { Scene } from './modules/scenes/entities/scene.entity';
import { ScenesModule } from './modules/scenes/scenes.module';
import { Song } from './modules/songs/entities/song.entity';
import { SongsModule } from './modules/songs/songs.module';
import { Track } from './modules/tracks/entities/track.entity';
import { TracksModule } from './modules/tracks/tracks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'music_licensing',
      schema: 'movies',
      entities: [Movie, Scene, Song, Track, LicenseStatus],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      csrfPrevention: false, // Deshabilitar CSRF para desarrollo
    }),
    CommonModule,
    MoviesModule,
    ScenesModule,
    SongsModule,
    TracksModule,
    LicensesModule,
  ],
  providers: [],
})
export class AppModule {}
