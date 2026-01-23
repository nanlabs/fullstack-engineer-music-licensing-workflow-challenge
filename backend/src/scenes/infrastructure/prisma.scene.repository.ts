import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Scene, SceneRepository } from '../domain/scene.interface';
import { Track } from '.prisma/client/edge';

@Injectable()
export class PrismaSceneRepository implements SceneRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<Track[] | null> {
        const scene = await this.prisma.scene.findUnique({
            where: { id },
            include: {
                tracks: true,
            }
        })
        return scene ? scene.tracks : null
    }

    async create(scene: Omit<Scene, 'id' | 'tracks'>): Promise<Scene> {
        return this.prisma.scene.create({
            data: scene,
        })
    }
}