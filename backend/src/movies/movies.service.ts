import { Injectable } from '@nestjs/common';
import { MoviesRepository } from './movies.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class MoviesService {
  constructor(private readonly moviesRepository: MoviesRepository) {}

  create(createMovieDto: Prisma.MovieCreateInput) {
    return this.moviesRepository.create(createMovieDto);
  }

  findAll() {
    return `This action returns all movies`;
  }

  findOne(id: string) {
    return this.moviesRepository.findOne(id);
  }

  update(id: string, updateMovieDto: Prisma.MovieUpdateInput) {
    return this.moviesRepository.update(id, updateMovieDto);
  }

  remove(id: string) {
    return this.moviesRepository.remove(id);
  }
}
