import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { Scene } from '../entities/scene.entity';
import { Movie } from '../entities/movie.entity';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PaginationHelper } from '../common/utils/pagination.util';

@Injectable()
export class ScenesService {
  private readonly logger = new Logger(ScenesService.name);

  constructor(
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(createSceneDto: CreateSceneDto): Promise<Scene> {
    this.logger.log(`Creating scene: ${createSceneDto.title}`);

    // Validate movie exists
    const movie = await this.movieRepository.findOne({
      where: { id: createSceneDto.movieId },
    });

    if (!movie) {
      throw new BadRequestException(
        `Movie with ID ${createSceneDto.movieId} not found`,
      );
    }

    // Validate endTime > startTime if both are provided
    if (
      createSceneDto.startTime !== undefined &&
      createSceneDto.endTime !== undefined &&
      createSceneDto.endTime <= createSceneDto.startTime
    ) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const scene = this.sceneRepository.create(createSceneDto);
      const saved = await queryRunner.manager.save(Scene, scene);
      await queryRunner.commitTransaction();
      this.logger.log(`Scene created successfully with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating scene: ${errorMessage}`, errorStack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create scene: ${errorMessage}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Scene>> {
    const { page: pageNum, limit: limitNum, skip } =
      PaginationHelper.getPaginationOptions(this.configService, page, limit);

    this.logger.log(`Fetching scenes - page: ${pageNum}, limit: ${limitNum}`);

    const [data, total] = await this.sceneRepository.findAndCount({
      relations: ['movie', 'tracks', 'tracks.song'],
      order: { createdAt: 'DESC' },
      skip,
      take: limitNum,
    });

    return PaginationHelper.createPaginatedResult(data, total, pageNum, limitNum);
  }

  async findByMovie(movieId: string): Promise<Scene[]> {
    this.logger.log(`Fetching scenes for movie ID: ${movieId}`);
    return this.sceneRepository.find({
      where: { movieId },
      relations: ['tracks', 'tracks.song', 'tracks.licensingStatusHistory'],
      order: { sceneNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Scene> {
    this.logger.log(`Fetching scene with ID: ${id}`);
    const scene = await this.sceneRepository.findOne({
      where: { id },
      relations: [
        'movie',
        'tracks',
        'tracks.song',
        'tracks.licensingStatusHistory',
      ],
    });

    if (!scene) {
      this.logger.warn(`Scene not found with ID: ${id}`);
      throw new NotFoundException(`Scene with ID ${id} not found`);
    }

    return scene;
  }

  async update(id: string, updateSceneDto: UpdateSceneDto): Promise<Scene> {
    this.logger.log(`Updating scene with ID: ${id}`);
    const scene = await this.findOne(id);

    // Validate movie exists if movieId is being updated
    if (updateSceneDto.movieId && updateSceneDto.movieId !== scene.movieId) {
      const movie = await this.movieRepository.findOne({
        where: { id: updateSceneDto.movieId },
      });

      if (!movie) {
        throw new BadRequestException(
          `Movie with ID ${updateSceneDto.movieId} not found`,
        );
      }
    }

    // Validate endTime > startTime if both are provided
    const startTime =
      updateSceneDto.startTime !== undefined
        ? updateSceneDto.startTime
        : scene.startTime;
    const endTime =
      updateSceneDto.endTime !== undefined
        ? updateSceneDto.endTime
        : scene.endTime;

    if (
      startTime !== undefined &&
      endTime !== undefined &&
      endTime <= startTime
    ) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      Object.assign(scene, updateSceneDto);
      const updated = await queryRunner.manager.save(Scene, scene);
      await queryRunner.commitTransaction();
      this.logger.log(`Scene updated successfully with ID: ${updated.id}`);
      return updated;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update scene: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting scene with ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const scene = await this.findOne(id);
      await queryRunner.manager.remove(Scene, scene);
      await queryRunner.commitTransaction();
      this.logger.log(`Scene deleted successfully with ID: ${id}`);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete scene: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
