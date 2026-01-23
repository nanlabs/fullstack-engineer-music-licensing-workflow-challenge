import { Injectable } from '@nestjs/common';
import { Movie } from '../domain/movie.interface';
import { PrismaMovieRepository } from '../infrastructure/prisma.movie.repository';

@Injectable()
export class GetMovies {
  constructor(private readonly movie: PrismaMovieRepository){}
  async execute(): Promise<Movie[]> {
    return this.movie.findAll()
  }
}