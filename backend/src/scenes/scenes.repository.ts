import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Scene, Prisma } from '@prisma/client';

@Injectable()
export class ScenesRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.SceneCreateInput): Promise<Scene> {
    return this.prisma.scene.create({ data });
  }

  async findAll(): Promise<Scene[]> {
    return this.prisma.scene.findMany({
      include: { tracks: true },
    });
  }

  async findOne(id: string): Promise<Scene | null> {
    return this.prisma.scene.findUnique({
      where: { id },
      include: { tracks: true },
    });
  }

  async update(id: string, data: Prisma.SceneUpdateInput): Promise<Scene> {
    return this.prisma.scene.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Scene> {
    return this.prisma.scene.delete({
      where: { id },
    });
  }
}
