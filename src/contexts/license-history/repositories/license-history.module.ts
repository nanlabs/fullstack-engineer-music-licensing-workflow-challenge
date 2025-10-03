import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { LicenseHistoryRepository } from '../domain/license-history.repository.interface'
import { LicenseHistoryRepositoryImpl } from './license-history.repository'
import { LicenseHistory } from '../domain/license-history.entity'

@Module({
  imports: [TypeOrmModule.forFeature([LicenseHistory])],
  providers: [
    {
      provide: LicenseHistoryRepository,
      useClass: LicenseHistoryRepositoryImpl,
    },
  ],
  exports: [LicenseHistoryRepository],
})
export class LicenseHistoryRespositoryModule {}
