import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly configService: ConfigService,
  ) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    this.logger.log(`Creating movie: ${createMovieDto.title}`);
    try {
      const movie = this.movieRepository.create(createMovieDto);
      const saved = await this.movieRepository.save(movie);
      this.logger.log(`Movie created successfully with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error creating movie: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Movie>> {
    const defaultPage =
      this.configService.get<number>('app.pagination.defaultPage') || 1;
    const defaultLimit =
      this.configService.get<number>('app.pagination.defaultLimit') || 10;
    const maxLimit =
      this.configService.get<number>('app.pagination.maxLimit') || 100;

    const pageNum = page || defaultPage;
    const limitNum = Math.min(limit || defaultLimit, maxLimit);

    this.logger.log(`Fetching movies - page: ${pageNum}, limit: ${limitNum}`);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await this.movieRepository.findAndCount({
      relations: ['scenes'],
      order: { createdAt: 'DESC' },
      skip,
      take: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  async findOne(id: string): Promise<Movie> {
    this.logger.log(`Fetching movie with ID: ${id}`);
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['scenes', 'scenes.tracks', 'scenes.tracks.song'],
    });

    if (!movie) {
      this.logger.warn(`Movie not found with ID: ${id}`);
      throw new NotFoundException(`Movie with ID ${id} not found`);
    }

    return movie;
  }

  async update(id: string, updateMovieDto: UpdateMovieDto): Promise<Movie> {
    this.logger.log(`Updating movie with ID: ${id}`);
    const movie = await this.findOne(id);

    Object.assign(movie, updateMovieDto);
    const updated = await this.movieRepository.save(movie);
    this.logger.log(`Movie updated successfully with ID: ${updated.id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting movie with ID: ${id}`);
    const movie = await this.findOne(id);
    await this.movieRepository.remove(movie);
    this.logger.log(`Movie deleted successfully with ID: ${id}`);
  }
}
