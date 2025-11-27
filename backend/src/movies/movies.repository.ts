import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Movie, Prisma } from '@prisma/client';

@Injectable()
export class MoviesRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.MovieCreateInput): Promise<Movie> {
    return this.prisma.movie.create({ data });
  }

  async findAll(): Promise<Movie[]> {
    return this.prisma.movie.findMany({
      include: { scenes: true },
    });
  }

  async findOne(id: string): Promise<Movie | null> {
    return this.prisma.movie.findUnique({
      where: { id },
      include: { scenes: true },
    });
  }

  async update(id: string, data: Prisma.MovieUpdateInput): Promise<Movie> {
    return this.prisma.movie.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Movie> {
    return this.prisma.movie.delete({
      where: { id },
    });
  }
}
