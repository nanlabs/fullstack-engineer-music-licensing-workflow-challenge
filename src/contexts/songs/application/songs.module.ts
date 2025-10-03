import { Module } from '@nestjs/common'

import { SongsRepositoryModule } from '../infrastructure/repositories/songs.module'
import { SongsService } from './songs.service'

@Module({
  imports: [SongsRepositoryModule],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsServiceModule {}
