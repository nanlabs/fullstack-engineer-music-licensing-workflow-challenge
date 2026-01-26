import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PaginationHelper } from '../common/utils/pagination.util';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    this.logger.log(`Creating movie: ${createMovieDto.title}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = this.movieRepository.create(createMovieDto);
      const saved = await queryRunner.manager.save(Movie, movie);
      await queryRunner.commitTransaction();
      this.logger.log(`Movie created successfully with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(
        `Error creating movie: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Movie>> {
    try {
      const {
        page: pageNum,
        limit: limitNum,
        skip,
      } = PaginationHelper.getPaginationOptions(this.configService, page, limit);

      this.logger.log(`Fetching movies - page: ${pageNum}, limit: ${limitNum}`);

      const [data, total] = await this.movieRepository.findAndCount({
        relations: ['scenes'],
        order: { createdAt: 'DESC' },
        skip,
        take: limitNum,
      });

      return PaginationHelper.createPaginatedResult(
        data,
        total,
        pageNum,
        limitNum,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be greater')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = await this.findOne(id);
      Object.assign(movie, updateMovieDto);
      const updated = await queryRunner.manager.save(Movie, movie);
      await queryRunner.commitTransaction();
      this.logger.log(`Movie updated successfully with ID: ${updated.id}`);
      return updated;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting movie with ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = await this.findOne(id);
      await queryRunner.manager.remove(Movie, movie);
      await queryRunner.commitTransaction();
      this.logger.log(`Movie deleted successfully with ID: ${id}`);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete movie: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
