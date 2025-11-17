import { Status } from '@/modules/licenses/entities/status.entity';
import { LicenseStatusEnum } from '@/modules/licenses/entities/license.status.enum';
import { BaseSeeder } from './base.seeder';

export class StatusSeeder extends BaseSeeder {
  async seed(): Promise<void> {
    const statusRepository = this.dataSource.getRepository(Status);

    const statuses = [
      { name: 'Pending', id: LicenseStatusEnum.PENDING },
      { name: 'In Negotiation', id: LicenseStatusEnum.IN_NEGOTIATION },
      { name: 'Cancelled', id: LicenseStatusEnum.CANCELLED },
      { name: 'Approved', id: LicenseStatusEnum.APPROVED },
      { name: 'Rejected', id: LicenseStatusEnum.REJECTED },
    ];

    for (const status of statuses) {
      const existing = await statusRepository.findOne({
        where: { id: status.id },
      });
      if (existing) {
        await statusRepository.update(status.id, status);
      } else {
        await statusRepository.save(status);
      }
    }
    console.log(`   Upserted ${statuses.length} statuses`);
  }
}
