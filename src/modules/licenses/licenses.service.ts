import { Injectable } from '@nestjs/common';
import { License, LicenseStatus } from '../../entities';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';
import { LicensesRepository } from './licenses.repository';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';
import {
  ResourceNotFoundException,
  InvalidStateTransitionException,
} from '../../common/exceptions';
import { TracksRepository } from '../tracks/tracks.repository';

@Injectable()
export class LicensesService {
  constructor(
    private licensesRepository: LicensesRepository,
    private updatesGateway: LicensesUpdatesGateway,
    private tracksRepository: TracksRepository,
  ) {}

  async create(createLicenseDto: CreateLicenseDto): Promise<License> {
    // Validate that track exists
    const track = await this.tracksRepository.findOne(createLicenseDto.trackId);
    if (!track) {
      throw new ResourceNotFoundException('Track', createLicenseDto.trackId);
    }

    return await this.licensesRepository.create(createLicenseDto);
  }

  async findAll(): Promise<License[]> {
    return await this.licensesRepository.findAll();
  }

  async findOne(id: string): Promise<License> {
    const license = await this.licensesRepository.findOne(id);
    if (!license) {
      throw new ResourceNotFoundException('License', id);
    }
    return license;
  }

  async findByTrackId(trackId: string): Promise<License | null> {
    return await this.licensesRepository.findByTrackId(trackId);
  }

  async updateStatus(
    id: string,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<License> {
    const license = await this.findOne(id);

    // Validate state transition
    if (
      !this.isValidTransition(license.status, updateLicenseStatusDto.status)
    ) {
      throw new InvalidStateTransitionException(
        license.status,
        updateLicenseStatusDto.status,
      );
    }

    await this.licensesRepository.update(id, updateLicenseStatusDto);

    const updatedLicense = await this.findOne(id);

    // Emitir actualización
    this.updatesGateway.emitLicenseUpdate(updatedLicense);

    return updatedLicense;
  }

  private isValidTransition(
    currentStatus: LicenseStatus,
    newStatus: LicenseStatus,
  ): boolean {
    const validTransitions: Record<LicenseStatus, LicenseStatus[]> = {
      [LicenseStatus.PENDING]: [
        LicenseStatus.NEGOTIATING,
        LicenseStatus.REJECTED,
      ],
      [LicenseStatus.NEGOTIATING]: [
        LicenseStatus.APPROVED,
        LicenseStatus.REJECTED,
      ],
      [LicenseStatus.APPROVED]: [],
      [LicenseStatus.REJECTED]: [LicenseStatus.PENDING],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  async remove(id: string): Promise<{ message: string }> {
    const license = await this.licensesRepository.findOne(id);
    if (!license) {
      throw new ResourceNotFoundException('License', id);
    }
    await this.licensesRepository.remove(id);
    return { message: 'License deleted successfully' };
  }
}
