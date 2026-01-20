import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  RmqEnvConfigModule,
  RmqEnvConfigService,
  rmqEnvConfigFactory,
} from '@app/rmq-env-config';

import { MovieController } from '../movie/movie.controller';
import { SongController } from '../song/song.controller';
import { TrackController } from '../track/track.controller';
import { SseController } from '../sse/sse.controller';
import { SongService } from '../song/song.service';
import { MovieService } from '../movie/movie.service';
import { TrackService } from '../track/track.service';
import { SseNotificationService } from '../sse/sse-notification.service';
import { INJECTION_TOKENS, QUEUES } from 'libs/shared';

@Module({
  imports: [
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
        name: INJECTION_TOKENS.MOVIE_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.MOVIE),
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
        name: INJECTION_TOKENS.TRACK_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.TRACK),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [MovieController, SongController, TrackController, SseController],
  providers: [MovieService, SongService, TrackService, SseNotificationService],
})
export class ApiGatewayModule {}
