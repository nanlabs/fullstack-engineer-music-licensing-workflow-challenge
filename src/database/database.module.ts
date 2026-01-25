import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Movie } from '../entities/movie.entity';
import { Scene } from '../entities/scene.entity';
import { Track } from '../entities/track.entity';
import { Song } from '../entities/song.entity';
import { LicensingStatus } from '../entities/licensing-status.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        return {
          type: 'postgres',
          ...dbConfig,
          entities: [Movie, Scene, Track, Song, LicensingStatus],
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
