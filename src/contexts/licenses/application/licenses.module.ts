import { Module } from '@nestjs/common'

import { LicenseHistoryRespositoryModule } from '../../license-history/repositories/license-history.module'
import { LicensesRespositoryModule } from '../../licenses/infrastructure/repositories/licenses.module'
import { LicensesService } from './licenses.service'

@Module({
  imports: [LicensesRespositoryModule, LicenseHistoryRespositoryModule],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesServiceModule {}
