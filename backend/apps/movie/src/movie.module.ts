import { Module } from '@nestjs/common';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
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
        name: INJECTION_TOKENS.API_GATEWAY_HOST,
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
    ]),
  ],
  controllers: [MovieController],
  providers: [MovieService],
})
export class MovieModule {}
