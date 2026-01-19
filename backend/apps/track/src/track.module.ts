import { Module } from '@nestjs/common';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  RmqEnvConfigModule,
  rmqEnvConfigFactory,
  RmqEnvConfigService,
} from '@app/rmq-env-config';
import { PostgresRepositoryModule } from 'libs/database';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PostgresRepositoryModule,
    ClientsModule.registerAsync([
      {
        imports: [RmqEnvConfigModule],
        name: 'TRACK_SERVICE',
        useFactory: rmqEnvConfigFactory('TRACK_QUEUE'),
        inject: [RmqEnvConfigService],
      },
      {
        imports: [RmqEnvConfigModule],
        name: 'SONG_SERVICE',
        useFactory: rmqEnvConfigFactory('SONG_QUEUE'),
        inject: [RmqEnvConfigService],
      },
      {
        imports: [RmqEnvConfigModule],
        name: 'MOVIE_SERVICE',
        useFactory: rmqEnvConfigFactory('MOVIE_QUEUE'),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [TrackController],
  providers: [TrackService],
})
export class TrackModule {}
