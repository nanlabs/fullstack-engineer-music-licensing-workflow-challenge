import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../../entities';
import { MoviesService } from './movies.service';
import { MoviesRepository } from './movies.repository';
import { MoviesController } from './movies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Movie])],
  controllers: [MoviesController],
  providers: [MoviesRepository, MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
