import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScenesService } from './scenes.service';
import { ScenesController } from './scenes.controller';
import { Scene } from '../entities/scene.entity';
import { Movie } from '../entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Scene, Movie])],
  controllers: [ScenesController],
  providers: [ScenesService],
  exports: [ScenesService],
})
export class ScenesModule {}
