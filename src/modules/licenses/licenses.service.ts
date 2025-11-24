import { Injectable } from '@nestjs/common';
import { License, LicenseStatus } from '../../entities';
import { CreateLicenseDto, UpdateLicenseStatusDto } from './dto';
import { LicensesRepository } from './licenses.repository';
import { LicensesUpdatesGateway } from './licenses-updates.gateway';

@Injectable()
export class LicensesService {
  constructor(
    private licensesRepository: LicensesRepository,
    private updatesGateway: LicensesUpdatesGateway,
  ) {}

  async create(createLicenseDto: CreateLicenseDto): Promise<License> {
    return await this.licensesRepository.create(createLicenseDto);
  }

  async findAll(): Promise<License[]> {
    return await this.licensesRepository.findAll();
  }

  async findOne(id: string): Promise<License | null> {
    return await this.licensesRepository.findOne(id);
  }

  async findByTrackId(trackId: string): Promise<License | null> {
    return await this.licensesRepository.findByTrackId(trackId);
  }

  async updateStatus(
    id: string,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ): Promise<License | null> {
    const license = await this.findOne(id);

    if (!license) {
      throw new Error(`License with id ${id} not found`);
    }

    // Validate state transition
    if (
      !this.isValidTransition(license.status, updateLicenseStatusDto.status)
    ) {
      throw new Error(
        `Invalid state transition from ${license.status} to ${updateLicenseStatusDto.status}`,
      );
    }

    await this.licensesRepository.update(id, updateLicenseStatusDto);

    const updatedLicense = await this.findOne(id);

    // Emitir actualización
    if (updatedLicense) {
      this.updatesGateway.emitLicenseUpdate(updatedLicense);
    }

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
    await this.licensesRepository.remove(id);
    return { message: 'License deleted successfully' };
  }
}
