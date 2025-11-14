import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { Movie } from './entities/movie.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MovieIdDto } from './dto/movie-id.dto';

const logger = new Logger('MoviesService');

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepo: Repository<Movie>,
  ) {}

  async create(createMovieDto: CreateMovieDto) {
    try {
      const movie = this.movieRepo.create(createMovieDto);
      await this.movieRepo.save(movie);
      logger.log(`Movie created: ${movie.id}`);
      return movie;
    } catch (error) {
      logger.error(`Error creating movie: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findAll() {
    try {
      const movies = await this.movieRepo.find();
      if (movies.length === 0) {
        logger.warn('There are no movies in the database');
        return [];
      }
      logger.log(`Found ${movies.length} movies`);
      return movies;
    } catch (error) {
      logger.error(`Error finding movies: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(movieIdDto: MovieIdDto) {
    const movieId = movieIdDto.movieId;
    try {
      const movie = await this.movieRepo.findOne({ where: { id: movieId } });
      if (!movie) {
        logger.warn(`Movie not found with id: ${movieId}`);
        throw new NotFoundException(`Movie not found with id: ${movieId}`);
      }
      return movie;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error finding movie: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }
}
