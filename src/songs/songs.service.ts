import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Song } from '../entities/song.entity';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    private readonly configService: ConfigService,
  ) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    this.logger.log(
      `Creating song: ${createSongDto.title} by ${createSongDto.artist}`,
    );
    try {
      const song = this.songRepository.create(createSongDto);
      const saved = await this.songRepository.save(song);
      this.logger.log(`Song created successfully with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error creating song: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create song: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Song>> {
    const defaultPage =
      this.configService.get<number>('app.pagination.defaultPage') || 1;
    const defaultLimit =
      this.configService.get<number>('app.pagination.defaultLimit') || 10;
    const maxLimit =
      this.configService.get<number>('app.pagination.maxLimit') || 100;

    const pageNum = page || defaultPage;
    const limitNum = Math.min(limit || defaultLimit, maxLimit);

    this.logger.log(`Fetching songs - page: ${pageNum}, limit: ${limitNum}`);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await this.songRepository.findAndCount({
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

  async findOne(id: string): Promise<Song> {
    this.logger.log(`Fetching song with ID: ${id}`);
    const song = await this.songRepository.findOne({
      where: { id },
      relations: ['tracks'],
    });

    if (!song) {
      this.logger.warn(`Song not found with ID: ${id}`);
      throw new NotFoundException(`Song with ID ${id} not found`);
    }

    return song;
  }

  async update(id: string, updateSongDto: UpdateSongDto): Promise<Song> {
    this.logger.log(`Updating song with ID: ${id}`);
    const song = await this.findOne(id);

    Object.assign(song, updateSongDto);
    const updated = await this.songRepository.save(song);
    this.logger.log(`Song updated successfully with ID: ${updated.id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting song with ID: ${id}`);
    const song = await this.findOne(id);
    await this.songRepository.remove(song);
    this.logger.log(`Song deleted successfully with ID: ${id}`);
  }
}
