import { TypeOrmModule } from '@nestjs/typeorm'
import { Module } from '@nestjs/common'

import { MoviesRepository } from '../../domain/movies.repository.interface'
import { MoviesRepositoryImpl } from './movies.repository'
import { Movies } from '../../domain/movies.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Movies])],
  providers: [
    {
      provide: MoviesRepository,
      useClass: MoviesRepositoryImpl,
    },
  ],
  exports: [MoviesRepository],
})
export class MoviesRespositoryModule {}
