/* e */
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { FindAllMoviesDto } from './dto/findAll-movies.dto';
import {
  calculatePagination,
  calculatePaginationResponse,
  deleteCacheByPattern,
} from '@/utils';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from './entities/movie.entity';
import { I18nService } from 'nestjs-i18n';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';
import type { RedisClientType } from '@redis/client';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectRepository(Movie) private movieRepository: Repository<Movie>,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private redisClient: RedisClientType | null,
  ) {}
  async create(createMovieDto: CreateMovieDto) {
    const movie = await this.movieRepository.save(createMovieDto);

    this.logger.log(`Movie created: ID ${movie.id} - "${movie.title}"`);

    await deleteCacheByPattern('movies:*', this.redisClient, this.cacheManager);

    return movie;
  }

  async findAll(findAllMoviesDto: FindAllMoviesDto) {
    const { page = 1, limit = 10, search } = findAllMoviesDto;
    const { skip, limit: paginationLimit } = calculatePagination(page, limit);
    const whereClause: FindOptionsWhere<Movie> = { is_deleted: false };
    const cacheKey = `movies:page:${page}:limit:${limit}${search ? `:search:${search}` : ''}`;

    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    if (search) {
      whereClause.title = ILike(`%${search}%`);
    }

    const [movies, count] = await this.movieRepository.findAndCount({
      skip,
      where: whereClause,
      take: paginationLimit,
      order: {
        created_at: 'DESC',
      },
    });

    const pagination = calculatePaginationResponse(
      count,
      page,
      paginationLimit,
    );

    const response = {
      data: movies,
      pagination,
    };

    await this.cacheManager.set(cacheKey, response, 60000); // 1 minute

    return response;
  }

  async findOne(id: number) {
    const movie = await this.movieRepository.findOne({
      where: { id, is_deleted: false },
    });

    if (!movie) {
      throw new I18nException(
        'events.movie.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    return movie;
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    const movie = await this.movieRepository.findOne({
      where: { id, is_deleted: false },
    });

    if (!movie) {
      throw new I18nException(
        'events.movie.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    await this.movieRepository.update(id, updateMovieDto);

    this.logger.log(`Movie updated: ID ${id}`);

    await deleteCacheByPattern('movies:*', this.redisClient, this.cacheManager);

    return this.movieRepository.findOne({ where: { id } });
  }

  async remove(id: number) {
    const movie = await this.movieRepository.findOne({
      where: { id, is_deleted: false },
    });

    if (!movie) {
      throw new I18nException(
        'events.movie.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    movie.is_deleted = true;
    await this.movieRepository.save(movie);

    this.logger.log(`Movie ${id} soft deleted`);

    await deleteCacheByPattern('movies:*', this.redisClient, this.cacheManager);

    return movie;
  }
}
