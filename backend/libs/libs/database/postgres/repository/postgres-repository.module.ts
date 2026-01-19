import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { TypeOrmRepositoryService } from './service/typeorm-repository.service';
import { MovieEntity, SongEntity } from 'libs/shared';
import {
  DatabaseConfig,
  DatabaseConfigModule,
  DatabaseConfigService,
} from 'libs/database/config';
import { LicensingEntity } from '@app/shared/LicensingEntity';
import { MovieSceneEntity } from '@app/shared/MovieSceneEntity';
import { TrackEntity } from '@app/shared/TrackEntity';

export const getTypeOrmModuleOptions = (
  databaseConfig: DatabaseConfig,
): TypeOrmModuleOptions =>
  ({
    type: 'postgres',
    host: databaseConfig.host,
    port: +databaseConfig.port,
    username: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.name,
    entities: [
      MovieEntity,
      SongEntity,
      LicensingEntity,
      MovieSceneEntity,
      TrackEntity,
    ],
    synchronize: true,
  }) as TypeOrmModuleOptions;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [DatabaseConfigModule],
      inject: [DatabaseConfigService],
      useFactory: getTypeOrmModuleOptions,
    }),
  ],
  providers: [TypeOrmRepositoryService],
  exports: [TypeOrmRepositoryService],
})
export class PostgresRepositoryModule {}
