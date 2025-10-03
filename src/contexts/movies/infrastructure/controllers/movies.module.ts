import { Module } from '@nestjs/common'

import { MoviesServiceModule } from '../../application/movies.module'
import { MoviesController } from './movies.controller'

@Module({
  imports: [MoviesServiceModule],
  controllers: [MoviesController],
})
export class MoviesControllerModule {}
