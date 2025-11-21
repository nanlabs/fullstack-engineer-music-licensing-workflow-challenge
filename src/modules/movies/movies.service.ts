import { Injectable } from '@nestjs/common';
import { Movie } from '../../entities';
import { CreateMovieDto, UpdateMovieDto } from './dto';
import { MoviesRepository } from './movies.repository';

@Injectable()
export class MoviesService {
  constructor(private moviesRepository: MoviesRepository) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    return await this.moviesRepository.create(createMovieDto);
  }

  async findAll(): Promise<Movie[]> {
    return await this.moviesRepository.findAll();
  }

  async findOne(id: string): Promise<Movie | null> {
    return await this.moviesRepository.findOne(id);
  }

  async update(
    id: string,
    updateMovieDto: UpdateMovieDto,
  ): Promise<Movie | null> {
    return await this.moviesRepository.update(id, updateMovieDto);
  }

  async remove(id: string): Promise<void> {
    return await this.moviesRepository.remove(id);
  }
}
