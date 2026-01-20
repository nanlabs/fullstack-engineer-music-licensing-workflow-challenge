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
import { INJECTION_TOKENS, QUEUES } from 'libs/shared';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PostgresRepositoryModule,
    ClientsModule.register([
      {
        name: INJECTION_TOKENS.API_GATEWAY_MICROSERVICE_CLIENT,
        transport: Transport.TCP,
        options: {
          port: Number(process.env.API_GATEWAY_PORT),
          host: process.env.API_GATEWAY_HOST,
        },
      },
    ]),
    ClientsModule.registerAsync([
      {
        imports: [RmqEnvConfigModule],
        name: INJECTION_TOKENS.TRACK_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.TRACK),
        inject: [RmqEnvConfigService],
      },
      {
        imports: [RmqEnvConfigModule],
        name: INJECTION_TOKENS.SONG_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.SONG),
        inject: [RmqEnvConfigService],
      },
      {
        imports: [RmqEnvConfigModule],
        name: INJECTION_TOKENS.MOVIE_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.MOVIE),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [TrackController],
  providers: [TrackService],
})
export class TrackModule {}
