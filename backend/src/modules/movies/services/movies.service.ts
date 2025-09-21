import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieDto } from '../dto/create-movie.dto';
import { UpdateMovieDto } from '../dto/update-movie.dto';
import { Movie } from '../entities/movie.entity';
import { MoviesRepository } from '../repositories/movies.repository';

@Injectable()
export class MoviesService {
  constructor(private readonly moviesRepository: MoviesRepository) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    // Business rule: Validate movie data before creation
    this.validateMovieData(createMovieDto);

    return await this.moviesRepository.create(createMovieDto);
  }

  async findAll(): Promise<Movie[]> {
    return await this.moviesRepository.findAll();
  }

  async findOne(id: number): Promise<Movie> {
    const movie = await this.moviesRepository.findById(id);

    if (!movie) {
      throw new NotFoundException(`Movie with ID ${id} not found`);
    }

    return movie;
  }

  async update(id: number, updateMovieDto: UpdateMovieDto): Promise<Movie> {
    // Business rule: Check if movie exists
    const movie = await this.findOne(id);

    // Business rule: Validate update data
    this.validateMovieData(updateMovieDto);

    // Apply updates
    Object.assign(movie, updateMovieDto);
    return await this.moviesRepository.update(movie);
  }

  async exists(id: number): Promise<boolean> {
    return await this.moviesRepository.exists(id);
  }

  // Private business logic methods
  private validateMovieData(movieData: CreateMovieDto | UpdateMovieDto): void {
    // Business rule: Release year must be valid if provided
    if (
      movieData.releaseYear &&
      (movieData.releaseYear < 1900 || movieData.releaseYear > new Date().getFullYear() + 10)
    ) {
      throw new Error('Release year must be between 1900 and 10 years in the future');
    }

    // Business rule: Status must be valid if provided
    const validStatuses = [
      'development',
      'pre-production',
      'production',
      'post-production',
      'released',
    ];
    if (movieData.status && !validStatuses.includes(movieData.status)) {
      throw new Error('Invalid movie status');
    }
  }
}
