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

@Module({
  imports: [
    ConfigModule.forRoot(),
    PostgresRepositoryModule,
    ClientsModule.register([
      {
        name: 'api-gateway-host',
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
    ]),
  ],
  controllers: [MovieController],
  providers: [MovieService],
})
export class MovieModule {}
