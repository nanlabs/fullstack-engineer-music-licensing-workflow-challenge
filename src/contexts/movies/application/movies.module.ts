import { Module } from '@nestjs/common'

import { MoviesRespositoryModule } from '../infrastructure/repositories/movies.module'
import { MoviesService } from './movies.service'

@Module({
  imports: [MoviesRespositoryModule],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesServiceModule {}
