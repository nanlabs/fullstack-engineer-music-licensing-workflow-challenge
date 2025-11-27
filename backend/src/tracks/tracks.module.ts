import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service';
import { TracksController } from './tracks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TracksRepository } from './tracks.repository';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [TracksController],
  providers: [TracksService, TracksRepository],
})
export class TracksModule {}
