import { Injectable } from '@nestjs/common';
import { Movie } from '../domain/movie.interface';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class GetMovie {
  constructor(private readonly movie: PrismaMovieRepository){}
  async execute(id: string): Promise<Movie | null> {
    return this.movie.findOne(id)
  }
}