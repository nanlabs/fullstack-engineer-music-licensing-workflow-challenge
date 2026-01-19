import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  RmqEnvConfigModule,
  RmqEnvConfigService,
  rmqEnvConfigFactory,
} from '@app/rmq-env-config';

@Module({
  imports: [
    ClientsModule.register([
      // {
      //   name: 'MOVIE_SERVICE',
      //   transport: Transport.RMQ,
      //   options: {
      //     urls: ['amqp://localhost:5672'],
      //     queue: 'movie_queue',
      //     queueOptions: {
      //       durable: false,
      //     },
      //   },
      // },
      {
        name: 'TRACK_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'track_queue',
          queueOptions: {
            durable: false,
          },
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
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
