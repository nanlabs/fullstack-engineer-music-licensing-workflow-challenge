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

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'API_GATEWAY_MICROSERVICE_CLIENT',
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
        name: 'MOVIE_SERVICE',
        useFactory: rmqEnvConfigFactory('MOVIE_QUEUE'),
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
        name: 'TRACK_SERVICE',
        useFactory: rmqEnvConfigFactory('TRACK_QUEUE'),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [MovieController, SongController, TrackController, SseController],
  providers: [MovieService, SongService, TrackService, SseNotificationService],
})
export class ApiGatewayModule {}
