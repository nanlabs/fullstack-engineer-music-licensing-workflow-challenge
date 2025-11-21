import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scene } from '../../entities';
import { ScenesService } from './scenes.service';
import { ScenesRepository } from './scenes.repository';
import { ScenesController } from './scenes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Scene])],
  controllers: [ScenesController],
  providers: [ScenesRepository, ScenesService],
  exports: [ScenesService],
})
export class ScenesModule {}
