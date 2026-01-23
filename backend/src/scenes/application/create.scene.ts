import { Injectable } from '@nestjs/common';
import type { Scene } from '../domain/scene.interface';
import { PrismaSceneRepository } from '../infrastructure/prisma.scene.repository';

@Injectable()
export class CreateScene {
    constructor( private readonly scene: PrismaSceneRepository) {}
    async execute(data: Omit<Scene, 'id' | 'tracks'>): Promise<Scene> {
        return this.scene.create(data)
    }
}