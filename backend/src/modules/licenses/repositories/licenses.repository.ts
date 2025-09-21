import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseStatusEnum } from '../../../common/enums/license-status.enum';
import { Song } from '../../songs/entities/song.entity';
import { CreateLicenseStatusDto } from '../dto/create-license-status.dto';
import { LicenseStatus } from '../entities/license-status.entity';

@Injectable()
export class LicensesRepository {
  constructor(
    @InjectRepository(LicenseStatus)
    private readonly licenseStatusRepository: Repository<LicenseStatus>,
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
  ) {}

  async create(createLicenseStatusDto: CreateLicenseStatusDto, song: Song): Promise<LicenseStatus> {
    // Create the license status with only the fields that exist in the entity
    const licenseStatusData = {
      status: createLicenseStatusDto.status,
      song: song,
    };

    const licenseStatus = this.licenseStatusRepository.create(licenseStatusData);
    return await this.licenseStatusRepository.save(licenseStatus);
  }

  async findBySongId(songId: number): Promise<LicenseStatus[]> {
    return await this.licenseStatusRepository.find({
      where: { song: { id: songId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findCurrentBySongId(songId: number): Promise<LicenseStatus | null> {
    return await this.licenseStatusRepository.findOne({
      where: { song: { id: songId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getStatusStatistics(): Promise<any> {
    const result = await this.licenseStatusRepository
      .createQueryBuilder('ls')
      .select('ls.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        `ls.id IN (
        SELECT DISTINCT ON (song_id) id 
        FROM license_statuses 
        ORDER BY song_id, created_at DESC
      )`,
      )
      .groupBy('ls.status')
      .getRawMany();

    const statistics = {
      [LicenseStatusEnum.PENDING]: 0,
      [LicenseStatusEnum.IN_REVIEW]: 0,
      [LicenseStatusEnum.NEGOTIATING]: 0,
      [LicenseStatusEnum.APPROVED]: 0,
      [LicenseStatusEnum.REJECTED]: 0,
      [LicenseStatusEnum.EXPIRED]: 0,
    };

    result.forEach((row) => {
      statistics[row.status] = parseInt(row.count);
    });

    return statistics;
  }

  async updateSongCurrentLicenseStatus(songId: number, licenseStatusId: number): Promise<void> {
    await this.songRepository.update({ id: songId }, { currentLicenseStatusId: licenseStatusId });
  }
}
