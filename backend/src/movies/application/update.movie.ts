import { Injectable, NotFoundException } from '@nestjs/common';
import { Movie } from '../domain/movie.interface';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class UpdateMovie {
    constructor(private readonly movie: PrismaMovieRepository) {}

    async execute(id: string, data: Partial<Omit<Movie, 'id'>>): Promise<Movie | null> {
      const movie = await this.movie.findOne(id)

      if (!movie) {
          throw new NotFoundException('Movie not found')
      }
      
      return this.movie.update(id, data)
    }
}