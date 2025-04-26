import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scene } from '../entities/scene.entity';
import { SceneService } from './scene.service';
import { SceneController } from './scene.controller';
import { Movie } from 'src/entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Scene, Movie])],
  providers: [SceneService],
  controllers: [SceneController],
})
export class SceneModule {}
