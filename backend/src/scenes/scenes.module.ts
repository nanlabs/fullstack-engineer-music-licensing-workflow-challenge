import { Module } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { ScenesController } from './scenes.controller';
import { ScenesRepository } from './scenes.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScenesController],
  providers: [ScenesService, ScenesRepository],
})
export class ScenesModule {}
