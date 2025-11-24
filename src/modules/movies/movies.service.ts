import { Injectable } from '@nestjs/common';
import { Movie } from '../../entities';
import { CreateMovieDto, UpdateMovieDto } from './dto';
import { MoviesRepository } from './movies.repository';
import { ResourceNotFoundException } from '../../common/exceptions';

@Injectable()
export class MoviesService {
  constructor(private moviesRepository: MoviesRepository) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    return await this.moviesRepository.create(createMovieDto);
  }

  async findAll(): Promise<Movie[]> {
    return await this.moviesRepository.findAll();
  }

  async findOne(id: string): Promise<Movie> {
    const movie = await this.moviesRepository.findOne(id);
    if (!movie) {
      throw new ResourceNotFoundException('Movie', id);
    }
    return movie;
  }

  async update(id: string, updateMovieDto: UpdateMovieDto): Promise<Movie> {
    const movie = await this.moviesRepository.update(id, updateMovieDto);
    if (!movie) {
      throw new ResourceNotFoundException('Movie', id);
    }
    return movie;
  }

  async remove(id: string): Promise<{ message: string }> {
    const movie = await this.moviesRepository.findOne(id);
    if (!movie) {
      throw new ResourceNotFoundException('Movie', id);
    }
    await this.moviesRepository.remove(id);
    return { message: 'Movie deleted successfully' };
  }
}
