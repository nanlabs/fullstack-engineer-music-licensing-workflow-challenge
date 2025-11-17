import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { LicenseStatusHistory } from '@/modules/licenses/entities/license-status-history.entity';
import { Status } from '@/modules/licenses/entities/status.entity';
import { Movie } from '@/modules/movies/entities/movie.entity';
import { Scene } from '@/modules/scenes/entities/scene.entity';
import { Song } from '@/modules/songs/entities/song.entity';
import { Track } from '@/modules/tracks/entities/track.entity';
import { License } from '@/modules/licenses/entities/license.entity';

export const TypeOrmConfig = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): DataSourceOptions => ({
    type: 'postgres',
    host: configService.get('DB_HOST'),
    port: +configService.get('DB_PORT'),
    username: configService.get('DB_USER'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_NAME'),
    synchronize: false,
    migrationsRun: true,
    migrations: [__dirname + '/../db/migrations/*{.ts,.js}'],
    entities: [
      Movie,
      Scene,
      Song,
      Track,
      License,
      Status,
      LicenseStatusHistory,
    ],
  }),
});
