import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { LicensesRepository } from '../../domain/licenses.repository.interface'
import { LicensesRepositoryImpl } from './licenses.repository'
import { Licenses } from '../../domain/licenses.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Licenses])],
  providers: [
    {
      provide: LicensesRepository,
      useClass: LicensesRepositoryImpl,
    },
  ],
  exports: [LicensesRepository],
})
export class LicensesRespositoryModule {}
