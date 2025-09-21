import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { LicenseUpdateGateway } from '../../../common/gateways/license-update.gateway';
import { SongsService } from '../../songs/services/songs.service';
import { TracksService } from '../../tracks/services/tracks.service';
import { CreateLicenseStatusDto } from '../dto/create-license-status.dto';
import { UpdateLicenseStatusDto } from '../dto/update-license-status.dto';
import { LicenseStatus } from '../entities/license-status.entity';
import { LicensesRepository } from '../repositories/licenses.repository';

@Injectable()
export class LicensesService {
  private readonly logger = new Logger(LicensesService.name);

  constructor(
    private readonly licensesRepository: LicensesRepository,
    @Inject(forwardRef(() => SongsService))
    private readonly songsService: SongsService,
    @Inject(forwardRef(() => TracksService))
    private readonly tracksService: TracksService,
    private readonly licenseUpdateGateway: LicenseUpdateGateway,
  ) {}

  async updateSongLicenseStatus(
    songId: number,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<LicenseStatus> {
    // Business rule: Song must exist
    const song = await this.songsService.findOne(songId);
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    // Business rule: Get current status for workflow validation
    const currentLicenseHistory = await this.licensesRepository.findBySongId(songId);
    const currentStatus = currentLicenseHistory.length > 0 ? currentLicenseHistory[0] : null;
    const newStatus = updateLicenseStatusDto.status;

    // Validate status transition
    this.validateStatusTransition(currentStatus?.status, newStatus);

    // Create new license status entry using proper DTO
    const createLicenseStatusDto: CreateLicenseStatusDto = {
      songId,
      status: updateLicenseStatusDto.status,
    };

    const savedLicenseStatus = await this.licensesRepository.create(createLicenseStatusDto, song);

    if (!savedLicenseStatus) {
      throw new Error('Failed to create license status');
    }

    // Update song's current license status reference
    await this.licensesRepository.updateSongCurrentLicenseStatus(songId, savedLicenseStatus.id);

    // Emit real-time update
    try {
      this.logger.log(`Attempting to emit WebSocket event for song ${songId}`);
      this.logger.log(`Gateway instance: ${!!this.licenseUpdateGateway}`);

      if (this.licenseUpdateGateway) {
        this.licenseUpdateGateway.emitLicenseStatusUpdate({
          songId,
          newStatus: savedLicenseStatus,
        });
        this.logger.log(`WebSocket emission completed for song ${songId}`);
      } else {
        this.logger.warn('LicenseUpdateGateway not available, skipping WebSocket emission');
      }
    } catch (error) {
      this.logger.error('Failed to emit license update via WebSocket:', error.message);
      this.logger.error('Error stack:', error.stack);
    }

    return savedLicenseStatus;
  }

  async getLicenseHistory(songId: number): Promise<LicenseStatus[]> {
    // Business rule: Song must exist
    const song = await this.songsService.findOne(songId);
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    return await this.licensesRepository.findBySongId(songId);
  }

  async getCurrentLicenseStatus(songId: number): Promise<LicenseStatus | null> {
    // Business rule: Song must exist
    const song = await this.songsService.findOne(songId);
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    return song.currentLicenseStatus;
  }

  private validateStatusTransition(
    currentStatus: LicenseStatusEnum | undefined,
    newStatus: LicenseStatusEnum,
  ): void {
    // Define allowed transitions
    const allowedTransitions: Record<LicenseStatusEnum, LicenseStatusEnum[]> = {
      [LicenseStatusEnum.PENDING]: [LicenseStatusEnum.IN_REVIEW, LicenseStatusEnum.REJECTED],
      [LicenseStatusEnum.IN_REVIEW]: [
        LicenseStatusEnum.NEGOTIATING,
        LicenseStatusEnum.APPROVED,
        LicenseStatusEnum.REJECTED,
        LicenseStatusEnum.PENDING, // Back to pending for revisions
      ],
      [LicenseStatusEnum.NEGOTIATING]: [
        LicenseStatusEnum.APPROVED,
        LicenseStatusEnum.REJECTED,
        LicenseStatusEnum.IN_REVIEW, // Back to review
      ],
      [LicenseStatusEnum.APPROVED]: [
        LicenseStatusEnum.EXPIRED,
        LicenseStatusEnum.NEGOTIATING, // Renegotiation
      ],
      [LicenseStatusEnum.REJECTED]: [
        LicenseStatusEnum.PENDING, // Resubmission
        LicenseStatusEnum.IN_REVIEW, // Direct to review
      ],
      [LicenseStatusEnum.EXPIRED]: [
        LicenseStatusEnum.PENDING, // Renewal process
        LicenseStatusEnum.NEGOTIATING, // Direct renegotiation
      ],
    };

    // If no current status, any status is allowed (initial state)
    if (!currentStatus) {
      return;
    }

    const allowedNextStatuses = allowedTransitions[currentStatus] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async updateSongLicenseStatusByTrack(
    trackId: number,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<LicenseStatus> {
    // Business rule: Track must exist
    const track = await this.tracksService.findOne(trackId);
    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    // Business rule: Track must have an associated song
    if (!track.songId) {
      throw new BadRequestException(`Track with ID ${trackId} has no associated song`);
    }

    // Delegate to updateSongLicenseStatus method
    return await this.updateSongLicenseStatus(track.songId, updateLicenseStatusDto);
  }

  async getCurrentLicenseStatusByTrack(trackId: number): Promise<LicenseStatus | null> {
    // Business rule: Track must exist
    const track = await this.tracksService.findOne(trackId);
    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    // Business rule: Track must have an associated song
    if (!track.songId) {
      throw new BadRequestException(`Track with ID ${trackId} has no associated song`);
    }

    // Delegate to getCurrentLicenseStatus method
    return await this.getCurrentLicenseStatus(track.songId);
  }
}
