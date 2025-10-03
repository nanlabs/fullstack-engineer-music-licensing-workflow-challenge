import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { SongsRepository } from '../../domain/songs.repository.interface'
import { SongsRepositoryImpl } from './songs.repository'
import { Songs } from '../../domain/songs.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Songs])],
  providers: [
    {
      provide: SongsRepository,
      useClass: SongsRepositoryImpl,
    },
  ],
  exports: [SongsRepository],
})
export class SongsRepositoryModule {}
