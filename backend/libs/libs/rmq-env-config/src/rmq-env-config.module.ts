import { Module } from '@nestjs/common';
import { RmqEnvConfigService } from './rmq-env-config.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [RmqEnvConfigService],
  exports: [RmqEnvConfigService],
})
export class RmqEnvConfigModule {}
