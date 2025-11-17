import { License } from '@/modules/licenses/entities/license.entity';
import { LicenseStatusHistory } from '@/modules/licenses/entities/license-status-history.entity';
import { Track } from '@/modules/tracks/entities/track.entity';
import { Status } from '@/modules/licenses/entities/status.entity';
import { LicenseStatusEnum } from '@/modules/licenses/entities/license.status.enum';
import { BaseSeeder } from './base.seeder';

export class LicenseSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const licenseRepository = this.dataSource.getRepository(License);
    const trackRepository = this.dataSource.getRepository(Track);
    const statusRepository = this.dataSource.getRepository(Status);
    const historyRepository =
      this.dataSource.getRepository(LicenseStatusHistory);

    const tracks = await trackRepository.find();
    const statuses = await statusRepository.find();

    if (tracks.length === 0) {
      throw new Error('No tracks found. Please seed tracks first.');
    }
    if (statuses.length === 0) {
      throw new Error('No statuses found. Please seed statuses first.');
    }

    const pendingStatus = statuses.find(
      (s) => s.id === Number(LicenseStatusEnum.PENDING),
    );
    const inNegotiationStatus = statuses.find(
      (s) => s.id === Number(LicenseStatusEnum.IN_NEGOTIATION),
    );
    const cancelledStatus = statuses.find(
      (s) => s.id === Number(LicenseStatusEnum.CANCELLED),
    );
    const approvedStatus = statuses.find(
      (s) => s.id === Number(LicenseStatusEnum.APPROVED),
    );
    const rejectedStatus = statuses.find(
      (s) => s.id === Number(LicenseStatusEnum.REJECTED),
    );

    if (
      !pendingStatus ||
      !inNegotiationStatus ||
      !cancelledStatus ||
      !approvedStatus ||
      !rejectedStatus
    ) {
      throw new Error('Required statuses not found.');
    }

    const licenses = tracks.map((track, index) => {
      let statusId = pendingStatus.id;
      if (index % 5 === 1) {
        statusId = inNegotiationStatus.id;
      } else if (index % 5 === 2) {
        statusId = cancelledStatus.id;
      } else if (index % 5 === 3) {
        statusId = approvedStatus.id;
      } else if (index % 5 === 4) {
        statusId = rejectedStatus.id;
      }

      return {
        track_id: track.id,
        status_id: statusId,
      };
    });

    for (const license of licenses) {
      const existing = await licenseRepository.findOne({
        where: { track_id: license.track_id },
      });
      if (existing) {
        await licenseRepository.update(existing.id, license);
      } else {
        await licenseRepository.save(license);
      }
    }
    console.log(`   Upserted ${licenses.length} licenses`);

    const allLicenses = await licenseRepository.find({
      relations: ['track'],
    });

    for (const license of allLicenses) {
      const existingHistory = await historyRepository.findOne({
        where: {
          license_id: license.id,
          status_id: license.status_id,
        },
        order: { created_at: 'DESC' },
      });

      if (!existingHistory) {
        await historyRepository.save({
          license_id: license.id,
          status_id: license.status_id,
        });
      }
    }

    const historyCount = await historyRepository.count();
    console.log(`   Upserted ${historyCount} license status history records`);
  }
}
