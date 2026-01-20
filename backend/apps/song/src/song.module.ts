import { Module } from '@nestjs/common';
import { SongController } from './song.controller';
import { SongService } from './song.service';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { PostgresRepositoryModule } from 'libs/database';
import {
  RmqEnvConfigModule,
  rmqEnvConfigFactory,
  RmqEnvConfigService,
} from '@app/rmq-env-config';
import { INJECTION_TOKENS, QUEUES } from 'libs/shared';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PostgresRepositoryModule,
    ClientsModule.registerAsync([
      {
        imports: [RmqEnvConfigModule],
        name: INJECTION_TOKENS.SONG_SERVICE,
        useFactory: rmqEnvConfigFactory(QUEUES.SONG),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [SongController],
  providers: [SongService],
})
export class SongModule {}
