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

  async findOne(id: string) {
    try {
      const movie = await this.movieRepo.findOne({ where: { id } });
      if (!movie) {
        logger.warn(`Movie not found with id: ${id}`);
        throw new NotFoundException(`Movie not found with id: ${id}`);
      }
      return movie;
    } catch (error) {
      logger.error(`Error finding movie: ${error}`);
      throw new InternalServerErrorException(error);
    }
  }
}
