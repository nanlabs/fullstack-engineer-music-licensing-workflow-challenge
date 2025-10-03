import { Module } from '@nestjs/common'

import { TracksServiceModule } from '../../application/tracks.module'
import { TracksController } from './tracks.controller'

@Module({
  imports: [TracksServiceModule],
  controllers: [TracksController],
})
export class TracksControllerModule {}
