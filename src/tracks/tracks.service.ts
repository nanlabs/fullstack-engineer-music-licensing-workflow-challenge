import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { Track, LicensingState } from '../entities/track.entity';
import { LicensingStatus } from '../entities/licensing-status.entity';
import { Scene } from '../entities/scene.entity';
import { Song } from '../entities/song.entity';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateLicensingStatusDto } from './dto/update-licensing-status.dto';
import { RealtimeService } from '../realtime/realtime.service';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PaginationHelper } from '../common/utils/pagination.util';

@Injectable()
export class TracksService {
  private readonly logger = new Logger(TracksService.name);

  constructor(
    @InjectRepository(Track)
    private readonly trackRepository: Repository<Track>,
    @InjectRepository(LicensingStatus)
    private readonly licensingStatusRepository: Repository<LicensingStatus>,
    @InjectRepository(Scene)
    private readonly sceneRepository: Repository<Scene>,
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
    private readonly configService: ConfigService,
  ) {}

  async create(createTrackDto: CreateTrackDto): Promise<Track> {
    this.logger.log(`Creating track for scene: ${createTrackDto.sceneId}`);

    // Validate foreign key relationships exist
    const [scene, song] = await Promise.all([
      this.sceneRepository.findOne({ where: { id: createTrackDto.sceneId } }),
      this.songRepository.findOne({ where: { id: createTrackDto.songId } }),
    ]);

    if (!scene) {
      throw new BadRequestException(
        `Scene with ID ${createTrackDto.sceneId} not found`,
      );
    }

    if (!song) {
      throw new BadRequestException(
        `Song with ID ${createTrackDto.songId} not found`,
      );
    }

    // Validate endTime > startTime
    if (createTrackDto.endTime <= createTrackDto.startTime) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const track = this.trackRepository.create({
        ...createTrackDto,
        currentLicensingStatus: LicensingState.PENDING,
      });

      const saved = await queryRunner.manager.save(Track, track);

      // Create initial licensing status
      const initialStatus = this.licensingStatusRepository.create({
        trackId: saved.id,
        status: LicensingState.PENDING,
        notes: 'Track created, awaiting licensing request',
        updatedBy: 'system',
      });
      await queryRunner.manager.save(LicensingStatus, initialStatus);

      await queryRunner.commitTransaction();

      // Get full track data with relations for event emission
      const fullTrack = await this.findOne(saved.id);

      // Emit real-time event for track creation
      this.realtimeService.emitTrackCreated(fullTrack);

      this.logger.log(`Track created successfully with ID: ${saved.id}`);
      return fullTrack;
    } catch (error) {
      // Only rollback if transaction was started
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creating track: ${errorMessage}`, errorStack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create track: ${errorMessage}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Track>> {
    try {
      const {
        page: pageNum,
        limit: limitNum,
        skip,
      } = PaginationHelper.getPaginationOptions(this.configService, page, limit);

      this.logger.log(`Fetching tracks - page: ${pageNum}, limit: ${limitNum}`);

      const [data, total] = await this.trackRepository.findAndCount({
        relations: ['scene', 'scene.movie', 'song', 'licensingStatusHistory'],
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

  async findByScene(sceneId: string): Promise<Track[]> {
    this.logger.log(`Fetching tracks for scene ID: ${sceneId}`);
    return this.trackRepository.find({
      where: { sceneId },
      relations: ['song', 'licensingStatusHistory'],
      order: { createdAt: 'ASC' },
    });
  }

  async findByMovie(movieId: string): Promise<Track[]> {
    this.logger.log(`Fetching tracks for movie ID: ${movieId}`);
    return this.trackRepository
      .createQueryBuilder('track')
      .leftJoinAndSelect('track.scene', 'scene')
      .leftJoinAndSelect('track.song', 'song')
      .leftJoinAndSelect('track.licensingStatusHistory', 'status')
      .where('scene.movieId = :movieId', { movieId })
      .orderBy('track.createdAt', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Track> {
    this.logger.log(`Fetching track with ID: ${id}`);
    const track = await this.trackRepository.findOne({
      where: { id },
      relations: ['scene', 'scene.movie', 'song', 'licensingStatusHistory'],
      order: {
        licensingStatusHistory: {
          createdAt: 'DESC',
        },
      },
    });

    if (!track) {
      this.logger.warn(`Track not found with ID: ${id}`);
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    return track;
  }

  async updateLicensingStatus(
    id: string,
    updateLicensingStatusDto: UpdateLicensingStatusDto,
  ): Promise<Track> {
    this.logger.log(`Updating licensing status for track ID: ${id}`);
    const track = await this.findOne(id);

    // Store old status for notification
    const oldStatus = track.currentLicensingStatus;

    // Prevent updating to the same status
    if (oldStatus === updateLicensingStatusDto.status) {
      throw new BadRequestException(
        `Track is already in ${updateLicensingStatusDto.status} status`,
      );
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Reload track within transaction to ensure it's managed by query runner
      const trackInTransaction = await queryRunner.manager.findOne(Track, {
        where: { id: track.id },
      });

      if (!trackInTransaction) {
        throw new NotFoundException(`Track with ID ${track.id} not found`);
      }

      // Create new status entry using the same pattern as create() method
      // Use repository.create() then save with query runner manager
      const newStatus = this.licensingStatusRepository.create({
        trackId: trackInTransaction.id,
        status: updateLicensingStatusDto.status,
        notes: updateLicensingStatusDto.notes,
        updatedBy: updateLicensingStatusDto.updatedBy || 'system',
      });
      // Save through query runner manager to ensure it's part of the transaction
      await queryRunner.manager.save(LicensingStatus, newStatus);

      // Update track's current status
      trackInTransaction.currentLicensingStatus =
        updateLicensingStatusDto.status;
      await queryRunner.manager.save(Track, trackInTransaction);

      await queryRunner.commitTransaction();

      // Reload relations on the existing track entity using the main repository
      // This avoids a second full query by reloading relations on the existing entity
      const reloadedTrack = await this.trackRepository.findOne({
        where: { id: track.id },
        relations: ['scene', 'scene.movie', 'song', 'licensingStatusHistory'],
      });

      const trackForEvent = reloadedTrack || track;

      // Emit real-time event for licensing status update
      this.realtimeService.emitLicensingStatusUpdate(
        trackForEvent,
        oldStatus,
        updateLicensingStatusDto.status,
        updateLicensingStatusDto.notes,
        updateLicensingStatusDto.updatedBy,
      );

      this.logger.log(
        `Licensing status updated to ${updateLicensingStatusDto.status} for track ID: ${id}`,
      );
      return trackForEvent;
    } catch (error) {
      // Only rollback if transaction was started
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error updating licensing status: ${errorMessage}`,
        errorStack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update licensing status: ${errorMessage}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting track with ID: ${id}`);
    const track = await this.findOne(id);

    // Store track data for event emission before deletion
    const trackId = track.id;
    const sceneId = track.sceneId;
    const movieId = track.scene?.movieId ?? undefined;

    await this.trackRepository.remove(track);

    // Emit real-time event for track deletion
    this.realtimeService.emitTrackDeleted(trackId, sceneId, movieId);

    this.logger.log(`Track deleted successfully with ID: ${id}`);
  }
}
