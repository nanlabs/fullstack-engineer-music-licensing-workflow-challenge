import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { TracksRepository } from '../../domain/tracks.repository.interface'
import { TracksRepositoryImpl } from './tracks.repository'
import { Tracks } from '../../domain/tracks.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Tracks])],
  providers: [
    {
      provide: TracksRepository,
      useClass: TracksRepositoryImpl,
    },
  ],
  exports: [TracksRepository],
})
export class TracksRespositoryModule {}
