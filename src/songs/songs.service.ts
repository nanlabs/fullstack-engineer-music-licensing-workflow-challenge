import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { Song } from '../entities/song.entity';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PaginationHelper } from '../common/utils/pagination.util';

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

  constructor(
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    this.logger.log(
      `Creating song: ${createSongDto.title} by ${createSongDto.artist}`,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const song = this.songRepository.create(createSongDto);
      const saved = await queryRunner.manager.save(Song, song);
      await queryRunner.commitTransaction();
      this.logger.log(`Song created successfully with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(
        `Error creating song: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create song: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(page?: number, limit?: number): Promise<PaginatedResult<Song>> {
    try {
      const {
        page: pageNum,
        limit: limitNum,
        skip,
      } = PaginationHelper.getPaginationOptions(this.configService, page, limit);

      this.logger.log(`Fetching songs - page: ${pageNum}, limit: ${limitNum}`);

      const [data, total] = await this.songRepository.findAndCount({
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const song = await this.findOne(id);
      Object.assign(song, updateSongDto);
      const updated = await queryRunner.manager.save(Song, song);
      await queryRunner.commitTransaction();
      this.logger.log(`Song updated successfully with ID: ${updated.id}`);
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
        `Failed to update song: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting song with ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const song = await this.findOne(id);
      await queryRunner.manager.remove(Song, song);
      await queryRunner.commitTransaction();
      this.logger.log(`Song deleted successfully with ID: ${id}`);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete song: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
