import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateLicenseDto } from './dto/create-license.dto';
import { I18nException } from '@/common/exceptions/i18n.exception';
import { Track } from '../tracks/entities/track.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Status } from './entities/status.entity';
import { License } from './entities/license.entity';
import { LicenseStatusEnum } from './entities/license.status.enum';
import { LicenseStatusHistory } from './entities/license-status-history.entity';
import { UpdateLicenseStatusDto } from './dto/updateStatus-license.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class LicensesService {
  private readonly logger = new Logger(LicensesService.name);

  constructor(
    @InjectRepository(Track)
    private trackRepository: Repository<Track>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(LicenseStatusHistory)
    private licenseStatusHistoryRepository: Repository<LicenseStatusHistory>,
    private websocketGateway: WebsocketGateway,
    private readonly i18n: I18nService,
  ) {}

  private getStatusName(statusId: LicenseStatusEnum): string {
    const statusMap: Record<LicenseStatusEnum, string> = {
      [LicenseStatusEnum.PENDING]: 'PENDING',
      [LicenseStatusEnum.IN_NEGOTIATION]: 'IN_NEGOTIATION',
      [LicenseStatusEnum.CANCELLED]: 'CANCELLED',
      [LicenseStatusEnum.APPROVED]: 'APPROVED',
      [LicenseStatusEnum.REJECTED]: 'REJECTED',
    };
    return statusMap[statusId] || 'UNKNOWN';
  }

  private async updateLicenseStatus(
    license: License,
    statusId: LicenseStatusEnum,
  ) {
    const previousStatus = license.status_id;
    const statusName = this.getStatusName(statusId);

    await this.licenseRepository.update(license.id, {
      status_id: statusId,
    });
    const licenseStatusHistory = this.licenseStatusHistoryRepository.create({
      license_id: license.id,
      status_id: statusId,
    });

    await this.licenseStatusHistoryRepository.save(licenseStatusHistory);

    this.logger.log(
      `License ${license.id} status changed: ${this.getStatusName(previousStatus)} -> ${statusName}`,
    );

    this.websocketGateway.emitLicenseStatusUpdate(
      license.id,
      statusId,
      statusName,
      license.track_id,
    );
  }

  private async statusMachine(
    statusId: LicenseStatusEnum,
    license: License,
    options: {
      created?: boolean;
      removed?: boolean;
    } = {},
  ): Promise<void> {
    const currentStatus = license.status_id;
    const { created = false, removed = false } = options;

    if (statusId === LicenseStatusEnum.PENDING) {
      if (currentStatus && !created) {
        throw new I18nException(
          'events.license.status.alreadyGenerated',
          HttpStatus.BAD_REQUEST,
          this.i18n,
        );
      }

      await this.updateLicenseStatus(license, LicenseStatusEnum.PENDING);
    }

    if (statusId === LicenseStatusEnum.APPROVED) {
      const allowedStatuses = [LicenseStatusEnum.IN_NEGOTIATION];

      if (!allowedStatuses.includes(currentStatus)) {
        throw new I18nException(
          'events.license.status.notAllowed',
          HttpStatus.BAD_REQUEST,
          this.i18n,
        );
      }
      await this.updateLicenseStatus(license, LicenseStatusEnum.APPROVED);
    }

    if (statusId === LicenseStatusEnum.CANCELLED) {
      const allowedStatuses = [LicenseStatusEnum.PENDING];
      const finalStatuses = [
        LicenseStatusEnum.APPROVED,
        LicenseStatusEnum.REJECTED,
        LicenseStatusEnum.CANCELLED,
      ];

      if (removed && finalStatuses.includes(currentStatus)) {
        return;
      }

      if (removed && !finalStatuses.includes(currentStatus)) {
        await this.updateLicenseStatus(license, LicenseStatusEnum.CANCELLED);
        return;
      }

      if (!allowedStatuses.includes(currentStatus)) {
        throw new I18nException(
          'events.license.status.notAllowed',
          HttpStatus.BAD_REQUEST,
          this.i18n,
        );
      }
      await this.updateLicenseStatus(license, LicenseStatusEnum.CANCELLED);
    }

    if (statusId === LicenseStatusEnum.REJECTED) {
      const allowedStatuses = [LicenseStatusEnum.IN_NEGOTIATION];

      if (!allowedStatuses.includes(currentStatus)) {
        throw new I18nException(
          'events.license.status.notAllowed',
          HttpStatus.BAD_REQUEST,
          this.i18n,
        );
      }
      await this.updateLicenseStatus(license, LicenseStatusEnum.REJECTED);
    }

    if (statusId === LicenseStatusEnum.IN_NEGOTIATION) {
      const allowedStatuses = [LicenseStatusEnum.PENDING];

      if (!allowedStatuses.includes(currentStatus)) {
        throw new I18nException(
          'events.license.status.notAllowed',
          HttpStatus.BAD_REQUEST,
          this.i18n,
        );
      }
      await this.updateLicenseStatus(license, LicenseStatusEnum.IN_NEGOTIATION);
    }
  }

  async create(createLicenseDto: CreateLicenseDto) {
    const { track_id } = createLicenseDto;

    const track = await this.trackRepository.findOneBy({ id: track_id });

    if (!track) {
      throw new I18nException(
        'events.track.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const existingLicense = await this.licenseRepository.findOneBy({
      track_id: track.id,
    });

    if (existingLicense) {
      throw new I18nException(
        'events.license.status.alreadyGenerated',
        HttpStatus.BAD_REQUEST,
        this.i18n,
      );
    }

    const license = this.licenseRepository.create({
      track_id: track.id,
      status_id: LicenseStatusEnum.PENDING,
    });

    const savedLicense = await this.licenseRepository.save(license);

    this.logger.log(
      `License created for track ${track_id} with ID ${savedLicense.id}`,
    );

    await this.statusMachine(LicenseStatusEnum.PENDING, savedLicense, {
      created: true,
    });

    return savedLicense;
  }

  async findOne(id: number) {
    const license = await this.licenseRepository.findOne({
      where: { id },
      relations: ['track', 'status'],
    });

    if (!license) {
      throw new I18nException(
        'events.license.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }
    return license;
  }

  async updateStatus(
    id: number,
    updateLicenseStatusDto: UpdateLicenseStatusDto,
  ) {
    const { status } = updateLicenseStatusDto;
    const license = await this.licenseRepository.findOneBy({ id });

    if (!license) {
      throw new I18nException(
        'events.license.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    this.logger.log(
      `Updating license ${id} status to ${this.getStatusName(status)}`,
    );
    await this.statusMachine(status, license);
  }

  async getHistory(id: number) {
    const license = await this.licenseRepository.findOneBy({ id });

    if (!license) {
      throw new I18nException(
        'events.license.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    const history = await this.licenseStatusHistoryRepository.find({
      where: { license_id: license.id },
      order: { created_at: 'DESC' },
    });

    return history;
  }

  async remove(id: number) {
    const license = await this.licenseRepository.findOneBy({ id });

    if (!license) {
      throw new I18nException(
        'events.license.notFound',
        HttpStatus.NOT_FOUND,
        this.i18n,
      );
    }

    this.logger.log(`Removing license ${id} (cancelling status)`);
    await this.statusMachine(LicenseStatusEnum.CANCELLED, license, {
      removed: true,
    });
  }
}
