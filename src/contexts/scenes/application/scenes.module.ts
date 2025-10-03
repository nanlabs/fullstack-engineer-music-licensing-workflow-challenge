import { Module } from '@nestjs/common'

import { MoviesRespositoryModule } from '../../movies/infrastructure/repositories/movies.module'
import { ScenesRespositoryModule } from '../infrastructure/repositories/scenes.module'
import { ScenesService } from './scenes.service'

@Module({
  imports: [MoviesRespositoryModule, ScenesRespositoryModule],
  providers: [ScenesService],
  exports: [ScenesService],
})
export class ScenesServiceModule {}
