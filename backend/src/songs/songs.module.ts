import { Module } from '@nestjs/common';
import { SongsService } from './songs.service';
import { SongsController } from './songs.controller';
import { SongsRepository } from './songs.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SongsController],
  providers: [SongsService, SongsRepository],
})
export class SongsModule {}
