import { Injectable } from '@nestjs/common';
import { PrismaSceneRepository } from '../infrastructure/prisma.scene.repository';
import { Track } from '@/tracks/domain/track.interface';

@Injectable()
export class GetSceneTracks {
    constructor(private readonly scene: PrismaSceneRepository) {}

    async execute(sceneId: string): Promise<Track[] | null> {
        return  this.scene.findById(sceneId)
    }
}