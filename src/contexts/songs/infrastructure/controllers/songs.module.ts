import { Module } from '@nestjs/common'

import { SongsServiceModule } from '../../application/songs.module'
import { SongsController } from './songs.controller'

@Module({
  imports: [SongsServiceModule],
  controllers: [SongsController],
})
export class SongsControllerModule {}
