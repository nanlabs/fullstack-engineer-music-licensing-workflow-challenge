import { Module } from '@nestjs/common';
import { ScenesController } from './controllers/scenes.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSceneRepository } from './infrastructure/prisma.scene.repository';
import { GetSceneTracks } from './application/get.scene.tracks';
import { CreateScene } from './application/create.scene';

@Module({
  imports: [],
  controllers: [ScenesController],
  providers: [
    PrismaService,
    PrismaSceneRepository,
    GetSceneTracks,
    CreateScene,
  ],
})
export class ScenesModule {}