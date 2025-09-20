import { Movie } from '../modules/movies/entities/movie.entity';
import { Scene } from '../modules/scenes/entities/scene.entity';
import { Track } from '../modules/tracks/entities/track.entity';
import { Song } from '../modules/songs/entities/song.entity';
import { LicenseStatus } from '../modules/licenses/entities/license-status.entity';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'music_licensing',
  schema: 'movies',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Movie, Scene, Track, Song, LicenseStatus],
  migrations: [__dirname + '/migrations/*.ts'],
  subscribers: [__dirname + '/subscribers/*.ts'],
});
