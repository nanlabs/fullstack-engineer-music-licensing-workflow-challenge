import { Module } from '@nestjs/common'

import { ScenesServiceModule } from '../../application/scenes.module'
import { ScenesController } from './scenes.controller'

@Module({
  imports: [ScenesServiceModule],
  controllers: [ScenesController],
})
export class ScenesControllerModule {}
