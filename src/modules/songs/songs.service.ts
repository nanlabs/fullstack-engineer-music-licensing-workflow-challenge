import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Song } from './entities/song.entity';
import { FindAllSongDto } from './dto/findAll-song.dto';
import {
  calculatePagination,
  calculatePaginationResponse,
  deleteCacheByPattern,
} from '@/utils';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { I18nService } from 'nestjs-i18n';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';
import type { RedisClientType } from '@redis/client';

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

  constructor(
    @InjectRepository(Song)
    private songRepository: Repository<Song>,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private redisClient: RedisClientType | null,
  ) {}

  async create(createSongDto: CreateSongDto) {
    const { title, artist, genre } = createSongDto;
    const song = this.songRepository.create({ title, artist, genre });
    const savedSong = await this.songRepository.save(song);

    this.logger.log(
      `Song created: ID ${savedSong.id} - "${title}" by ${artist}`,
    );

    // Invalidate all song-related cache keys (e.g., songs:page:*)
    await deleteCacheByPattern('songs:*', this.redisClient, this.cacheManager);

    return savedSong;
  }

  async findAll(findAllSongDto: FindAllSongDto) {
    const { page = 1, limit = 10, title, artist } = findAllSongDto;
    const { skip, limit: paginationLimit } = calculatePagination(page, limit);
    const cacheKey = `songs:page:${page}:limit:${limit}${title ? `:title:${title}` : ''}${artist ? `:artist:${artist}` : ''}`;

    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const where: FindOptionsWhere<Song> = { is_deleted: false };

    if (title) {
      where.title = ILike(`%${title}%`);
    }
    if (artist) {
      where.artist = ILike(`%${artist}%`);
    }
    const [songs, count] = await this.songRepository.findAndCount({
      skip,
      take: paginationLimit,
      where,
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
      data: songs,
      pagination,
    };

    await this.cacheManager.set(cacheKey, response, 60000); // 1 minute

    return response;
  }

  async findOne(id: number) {
    const song = await this.songRepository.findOneBy({ id, is_deleted: false });

    if (!song) {
      throw new I18nException(
        'events.song.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    return song;
  }

  async update(id: number, updateSongDto: UpdateSongDto) {
    const song = await this.songRepository.findOneBy({ id });
    if (!song) {
      throw new I18nException(
        'events.song.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }
    Object.assign(song, updateSongDto);
    const updatedSong = await this.songRepository.save(song);

    this.logger.log(`Song updated: ID ${id}`);

    // Invalidate all song-related cache keys (e.g., songs:page:*)
    await deleteCacheByPattern('songs:*', this.redisClient, this.cacheManager);

    return updatedSong;
  }

  async remove(id: number) {
    const song = await this.songRepository.findOneBy({ id, is_deleted: false });
    if (!song) {
      throw new I18nException(
        'events.song.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    song.is_deleted = true;
    await this.songRepository.save(song);

    this.logger.log(`Song ${id} soft deleted`);

    // Invalidate all song-related cache keys (e.g., songs:page:*)
    await deleteCacheByPattern('songs:*', this.redisClient, this.cacheManager);

    return song;
  }
}
