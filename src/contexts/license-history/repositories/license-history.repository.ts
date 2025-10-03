import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'

import { LicenseHistoryRepository } from '../domain/license-history.repository.interface'
import { LicenseHistory } from '../domain/license-history.entity'

@Injectable()
export class LicenseHistoryRepositoryImpl implements LicenseHistoryRepository {
  constructor(
    @InjectRepository(LicenseHistory)
    private readonly licenseHistoryRepository: Repository<LicenseHistory>,
  ) {}
  async create(
    licenseHistory: Pick<
      LicenseHistory,
      'licenseId' | 'oldStatus' | 'newStatus'
    >,
  ): Promise<void> {
    await this.licenseHistoryRepository.insert(licenseHistory)
  }
}
