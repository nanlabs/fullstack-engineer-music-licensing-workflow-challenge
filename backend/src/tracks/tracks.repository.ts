import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Track, Prisma } from '@prisma/client';

@Injectable()
export class TracksRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.TrackCreateInput): Promise<Track> {
    return this.prisma.track.create({ data });
  }

  async findAll(): Promise<Track[]> {
    return this.prisma.track.findMany({
      include: { scene: true, song: true },
    });
  }

  async findOne(id: string): Promise<Track | null> {
    return this.prisma.track.findUnique({
      where: { id },
      include: { scene: true, song: true },
    });
  }

  async update(id: string, data: Prisma.TrackUpdateInput): Promise<Track> {
    return this.prisma.track.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Track> {
    return this.prisma.track.delete({
      where: { id },
    });
  }
}
