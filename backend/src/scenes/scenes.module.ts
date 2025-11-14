import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { Scene } from './entities/scene.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/movies/entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Scene, Movie])],
  controllers: [ScenesController],
  providers: [ScenesService],
  exports: [TypeOrmModule],
})
export class ScenesModule {}
