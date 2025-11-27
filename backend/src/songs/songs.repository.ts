import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Song, Prisma } from '@prisma/client';

@Injectable()
export class SongsRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.SongCreateInput): Promise<Song> {
    return this.prisma.song.create({ data });
  }

  async findAll(): Promise<Song[]> {
    return this.prisma.song.findMany();
  }

  async findOne(id: string): Promise<Song | null> {
    return this.prisma.song.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Prisma.SongUpdateInput): Promise<Song> {
    return this.prisma.song.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Song> {
    return this.prisma.song.delete({
      where: { id },
    });
  }
}
