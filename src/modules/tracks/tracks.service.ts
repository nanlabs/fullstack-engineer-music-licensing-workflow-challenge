import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Track } from './entities/track.entity';
import { FindAllByMovieIdTrackDto } from './dto/findAllByMovieID-track.dto';
import {
  calculatePagination,
  calculatePaginationResponse,
  deleteCacheByPattern,
} from '@/utils';
import { FindAllBySceneIdTrackDto } from './dto/findAllBySceneID-track.dto';
import { Song } from '../songs/entities/song.entity';
import { Scene } from '../scenes/entities/scene.entity';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { LicensesService } from '../licenses/licenses.service';
import { UpdateTrackLicenseStatusDto } from './dto/updateTrackLicenseStatus-track.dto';
import { I18nService } from 'nestjs-i18n';
import { Movie } from '../movies/entities/movie.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { REDIS_CLIENT } from '@/config/redis.config';
import type { RedisClientType } from '@redis/client';

@Injectable()
export class TracksService {
  private readonly logger = new Logger(TracksService.name);

  constructor(
    @InjectRepository(Track)
    private trackRepository: Repository<Track>,
    @InjectRepository(Song)
    private songRepository: Repository<Song>,
    @InjectRepository(Scene)
    private sceneRepository: Repository<Scene>,
    private licenseService: LicensesService,
    private readonly i18n: I18nService,
    @InjectRepository(Movie)
    private movieRepository: Repository<Movie>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private redisClient: RedisClientType | null,
  ) {}

  async create(createTrackDto: CreateTrackDto) {
    const { scene_id, song_id, start_time_seconds, end_time_seconds } =
      createTrackDto;

    const [song, scene] = await Promise.all([
      this.songRepository.findOneBy({
        id: song_id,
        is_deleted: false,
      }),
      this.sceneRepository.findOneBy({
        id: scene_id,
        is_deleted: false,
      }),
    ]);

    if (!song) {
      throw new I18nException(
        'events.song.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    if (!scene) {
      throw new I18nException(
        'events.scene.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const track = this.trackRepository.create({
      scene,
      song,
      start_time_seconds,
      end_time_seconds,
    });

    const savedTrack = await this.trackRepository.save(track);

    this.logger.log(
      `Track created: ID ${savedTrack.id} for scene ${scene_id} with song ${song_id}`,
    );

    await this.licenseService.create({ track_id: savedTrack.id });

    // Invalidate all track-related cache keys for this movie and scene
    await Promise.all([
      deleteCacheByPattern(
        `tracks:movie:${scene.movie_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
      deleteCacheByPattern(
        `tracks:scene:${scene_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
    ]);

    return savedTrack;
  }

  async findAllByMovieId(
    movieId: number,
    findAllByMovieIdTrackDto: FindAllByMovieIdTrackDto,
  ) {
    const { page = 1, limit = 10 } = findAllByMovieIdTrackDto;
    const { skip, limit: paginationLimit } = calculatePagination(page, limit);

    const movie = await this.movieRepository.findOneBy({
      id: movieId,
      is_deleted: false,
    });

    if (!movie) {
      throw new I18nException(
        'events.movie.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const cacheKey = `tracks:movie:${movieId}:page:${page}:limit:${limit}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const where: FindOptionsWhere<Track> = {
      scene: { movie_id: movie.id },
      is_deleted: false,
    };

    const [tracks, count] = await this.trackRepository.findAndCount({
      skip,
      take: paginationLimit,
      where,
      relations: {
        license: true,
      },
      order: {
        created_at: 'DESC',
      },
    });

    const response = {
      data: tracks,
      pagination: calculatePaginationResponse(count, page, paginationLimit),
    };

    await this.cacheManager.set(cacheKey, response, 60000); // 1 minute

    return response;
  }

  async findAllBySceneId(
    sceneId: number,
    findAllBySceneIdTrackDto: FindAllBySceneIdTrackDto,
  ) {
    const { page = 1, limit = 10 } = findAllBySceneIdTrackDto;
    const { skip, limit: paginationLimit } = calculatePagination(page, limit);

    const scene = await this.sceneRepository.findOneBy({
      id: sceneId,
      is_deleted: false,
    });

    if (!scene) {
      throw new I18nException(
        'events.scene.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const cacheKey = `tracks:scene:${sceneId}:page:${page}:limit:${limit}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const where: FindOptionsWhere<Track> = {
      is_deleted: false,
      scene: { id: scene.id },
    };

    const [tracks, count] = await this.trackRepository.findAndCount({
      where,
      skip,
      take: paginationLimit,
      relations: {
        license: true,
      },
      order: {
        created_at: 'DESC',
      },
    });

    const response = {
      data: tracks,
      pagination: calculatePaginationResponse(count, page, paginationLimit),
    };

    await this.cacheManager.set(cacheKey, response, 60000); // 1 minute

    return response;
  }

  async findOne(id: number) {
    const track = await this.trackRepository.findOne({
      where: { id, is_deleted: false },
      relations: {
        scene: true,
        license: {
          status: true,
        },
      },
    });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }
    return track;
  }

  async update(id: number, updateTrackDto: UpdateTrackDto) {
    const { start_time_seconds, end_time_seconds } = updateTrackDto;
    const track = await this.trackRepository.findOne({
      where: { id, is_deleted: false },
      relations: { scene: true },
    });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }
    if (start_time_seconds) {
      track.start_time_seconds = start_time_seconds;
    }
    if (end_time_seconds) {
      track.end_time_seconds = end_time_seconds;
    }

    const savedTrack = await this.trackRepository.save(track);

    // Invalidate all track-related cache keys for this movie and scene
    await Promise.all([
      deleteCacheByPattern(
        `tracks:scene:${track.scene_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
      deleteCacheByPattern(
        `tracks:movie:${track.scene.movie_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
    ]);

    return savedTrack;
  }

  async updateLicenseStatus(
    id: number,
    updateLicenseStatusDto: UpdateTrackLicenseStatusDto,
  ) {
    const { status } = updateLicenseStatusDto;
    const track = await this.trackRepository.findOne({
      where: { id, is_deleted: false },
      relations: { license: true },
      select: {
        id: true,
        license: {
          id: true,
        },
      },
    });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    await this.licenseService.updateStatus(track.license.id, { status });
  }

  async getLicenseHistory(id: number) {
    const track = await this.trackRepository.findOne({
      where: { id, is_deleted: false },
      relations: { license: true },
    });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const licenseHistory = await this.licenseService.getHistory(
      track.license.id,
    );
    return licenseHistory;
  }

  async remove(id: number) {
    const track = await this.trackRepository.findOne({
      where: { id, is_deleted: false },
      relations: { license: true, scene: true },
    });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    track.is_deleted = true;
    await this.trackRepository.save(track);

    this.logger.log(`Track ${id} soft deleted`);

    await this.licenseService.remove(track.license.id);
    await Promise.all([
      deleteCacheByPattern(
        `tracks:scene:${track.scene_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
      deleteCacheByPattern(
        `tracks:movie:${track.scene.movie_id}*`,
        this.redisClient,
        this.cacheManager,
      ),
    ]);
  }
}
