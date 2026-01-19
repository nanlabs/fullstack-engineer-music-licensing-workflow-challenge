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

@Module({
  imports: [
    ConfigModule.forRoot(),
    PostgresRepositoryModule,
    ClientsModule.registerAsync([
      {
        imports: [RmqEnvConfigModule],
        name: 'SONG_SERVICE',
        useFactory: rmqEnvConfigFactory('SONG_QUEUE'),
        inject: [RmqEnvConfigService],
      },
    ]),
  ],
  controllers: [SongController],
  providers: [SongService],
})
export class SongModule {}
