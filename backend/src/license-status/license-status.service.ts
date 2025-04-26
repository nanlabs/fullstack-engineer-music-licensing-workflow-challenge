import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseStatus, Status } from '../entities/license-status.entity';
import { LicenseStatusGateway } from './license-status.gateway';

@Injectable()
export class LicenseStatusService {
  constructor(
    @InjectRepository(LicenseStatus)
    private licenseStatusRepository: Repository<LicenseStatus>,
    private readonly gateway: LicenseStatusGateway, // 👈 inyectar el gateway
  ) {}

  async findAll(): Promise<LicenseStatus[]> {
    return this.licenseStatusRepository.find();
  }

  async findOne(id: number): Promise<LicenseStatus> {
    const license = await this.licenseStatusRepository.findOne({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException('LicenseStatus not found');
    }

    return license;
  }

  async create(data: Partial<LicenseStatus>): Promise<LicenseStatus> {
    const status = this.licenseStatusRepository.create(data);
    return this.licenseStatusRepository.save(status);
  }

  async updateStatus(id: number, newStatus: Status): Promise<LicenseStatus> {
    const license = await this.licenseStatusRepository.findOne({
      where: { id },
    });

    if (!license) throw new NotFoundException('LicenseStatus not found');

    license.status = newStatus;
    license.updatedAt = new Date();

    const updated = await this.licenseStatusRepository.save(license);

    this.gateway.notifyStatusUpdate(updated);

    return updated;
  }
}
