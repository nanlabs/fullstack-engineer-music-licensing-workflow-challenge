import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scene } from '../../entities';
import { ScenesService } from './scenes.service';
import { ScenesRepository } from './scenes.repository';
import { ScenesController } from './scenes.controller';
import { MoviesModule } from '../movies/movies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Scene]), MoviesModule],
  controllers: [ScenesController],
  providers: [ScenesRepository, ScenesService],
  exports: [ScenesService, ScenesRepository],
})
export class ScenesModule {}
