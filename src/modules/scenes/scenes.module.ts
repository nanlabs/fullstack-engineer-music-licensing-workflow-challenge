import { Module } from '@nestjs/common';
import { ScenesService } from './scenes.service';
import { ScenesController } from './scenes.controller';
import { Scene } from './entities/scene.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../movies/entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Scene, Movie])],
  controllers: [ScenesController],
  providers: [ScenesService],
})
export class ScenesModule {}
