import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { ScenesRepository } from '../../domain/scenes.repository.interface'
import { ScenesRepositoryImpl } from './scenes.repository'
import { Scenes } from '../../domain/scenes.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Scenes])],
  providers: [
    {
      provide: ScenesRepository,
      useClass: ScenesRepositoryImpl,
    },
  ],
  exports: [ScenesRepository],
})
export class ScenesRespositoryModule {}
