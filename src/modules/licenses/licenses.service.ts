import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from '../../entities/license.entity';
import { Track } from '../../entities/track.entity';
import { LicensingStatus, LICENSING_STATUS_TRANSITIONS } from '../../entities/enums/licensing-status.enum';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { UpdateLicenseStatusDto } from './dto/update-license-status.dto';
import { LicensesResolver } from './licenses.resolver';
import { LicenseStatusChangedDto } from './dto/license-status-changed.dto';
import { EmailService } from '../../services/email.service';
import { CacheService } from '../../services/cache.service';

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(Track)
    private readonly trackRepository: Repository<Track>,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createLicenseDto: CreateLicenseDto): Promise<License> {
    const { trackId, ...licenseData } = createLicenseDto;

    const track = await this.trackRepository.findOne({ where: { id: trackId } });
    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    const license = this.licenseRepository.create({
      ...licenseData,
      trackId: track.id,
      lastStatusChange: new Date(),
    });

    return await this.licenseRepository.save(license);
  }

  async findAll(): Promise<License[]> {
    return await this.licenseRepository.find({
      relations: ['track', 'track.scene', 'track.song'],
    });
  }

  async findByStatus(status: LicensingStatus): Promise<License[]> {
    return await this.licenseRepository.find({
      where: { status },
      relations: ['track', 'track.scene', 'track.song'],
    });
  }

  async findOne(id: string): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['track', 'track.scene', 'track.scene.movie', 'track.song'],
    });

    if (!license) {
      throw new NotFoundException(`License with ID ${id} not found`);
    }

    return license;
  }

  async update(id: string, updateLicenseDto: UpdateLicenseDto): Promise<License> {
    const license = await this.findOne(id);
    const { trackId, ...licenseData } = updateLicenseDto;

    if (trackId) {
      const track = await this.trackRepository.findOne({ where: { id: trackId } });
      if (!track) {
        throw new NotFoundException(`Track with ID ${trackId} not found`);
      }
      license.trackId = trackId;
    }

    Object.assign(license, licenseData);
    return await this.licenseRepository.save(license);
  }

  async updateStatus(id: string, updateStatusDto: UpdateLicenseStatusDto): Promise<License> {
    const license = await this.findOne(id);
    const { status, notes } = updateStatusDto;
    const oldStatus = license.status;

    // Validate status transition
    const allowedTransitions = LICENSING_STATUS_TRANSITIONS[license.status];
    if (!allowedTransitions.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${license.status} to ${status}. Allowed transitions: ${allowedTransitions.join(', ')}`
      );
    }

    // Update license
    license.status = status;
    if (notes) {
      license.notes = notes;
    }

    // Set timestamp for status change
    license.lastStatusChange = new Date();

    const updatedLicense = await this.licenseRepository.save(license);

    // Emit real-time event
    const statusChangeEvent: LicenseStatusChangedDto = {
      licenseId: updatedLicense.id,
      trackId: updatedLicense.track.id,
      oldStatus,
      newStatus: status,
      notes: notes || null,
      changedAt: updatedLicense.lastStatusChange,
      trackName: updatedLicense.track.name,
      songTitle: updatedLicense.track.song.title,
      songArtist: updatedLicense.track.song.artist,
      movieTitle: updatedLicense.track.scene.movie.title,
      sceneName: updatedLicense.track.scene.name,
    };

    LicensesResolver.publishLicenseStatusChange(statusChangeEvent);

    // Send email notification
    await this.emailService.sendLicenseStatusChangeNotification({
      email: updatedLicense.contactEmail || 'licensing@example.com',
      licenseId: updatedLicense.id,
      trackId: updatedLicense.track.id,
      oldStatus,
      newStatus: status,
      trackName: updatedLicense.track.name,
      songTitle: updatedLicense.track.song.title,
      songArtist: updatedLicense.track.song.artist,
      movieTitle: updatedLicense.track.scene.movie.title,
      sceneName: updatedLicense.track.scene.name,
      contactPerson: updatedLicense.contactPerson,
    });

    // Invalidate workflow summary cache
    await this.cacheService.del('workflow-summary');

    return updatedLicense;
  }

  async remove(id: string): Promise<void> {
    const license = await this.findOne(id);
    await this.licenseRepository.remove(license);
  }

  async getWorkflowSummary(): Promise<Record<LicensingStatus, number>> {
    const cacheKey = 'workflow-summary';

    // Try to get from cache first
    const cached = await this.cacheService.get<Record<LicensingStatus, number>>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from database
    const counts = await this.licenseRepository
      .createQueryBuilder('license')
      .select('license.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('license.status')
      .getRawMany();

    const summary = {} as Record<LicensingStatus, number>;
    for (const status of Object.values(LicensingStatus)) {
      summary[status] = 0;
    }

    counts.forEach(({ status, count }) => {
      summary[status] = parseInt(count);
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, summary, 300);

    return summary;
  }
}