import { Module } from '@nestjs/common'

import { LicensesRespositoryModule } from '../../licenses/infrastructure/repositories/licenses.module'
import { ScenesRespositoryModule } from '../../scenes/infrastructure/repositories/scenes.module'
import { SongsRepositoryModule } from '../../songs/infrastructure/repositories/songs.module'
import { TracksRespositoryModule } from '../infrastructure/repositories/tracks.module'
import { TracksService } from './tracks.service'

@Module({
  imports: [
    TracksRespositoryModule,
    SongsRepositoryModule,
    ScenesRespositoryModule,
    LicensesRespositoryModule,
  ],
  providers: [TracksService],
  exports: [TracksService],
})
export class TracksServiceModule {}
