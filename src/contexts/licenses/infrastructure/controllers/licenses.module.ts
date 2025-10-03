import { Module } from '@nestjs/common'

import { LicensesServiceModule } from '../../application/licenses.module'
import { LicensesController } from './licenses.controller'

@Module({
  imports: [LicensesServiceModule],
  controllers: [LicensesController],
})
export class LicensesControllerModule {}
