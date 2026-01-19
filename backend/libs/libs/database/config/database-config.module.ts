import { Module } from '@nestjs/common';
import { DatabaseConfigService } from './database-config.service';

@Module({
  providers: [DatabaseConfigService],
  exports: [DatabaseConfigService],
})
export class DatabaseConfigModule {}
