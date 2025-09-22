import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviesController } from './controllers/movies.controller';
import { MoviesService } from './services/movies.service';
import { MoviesRepository } from './repositories/movies.repository';
import { MoviesResolver } from './resolvers/movies.resolver';
import { Movie } from './entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Movie])],
  controllers: [MoviesController],
  providers: [MoviesService, MoviesRepository, MoviesResolver],
  exports: [MoviesService],
})
export class MoviesModule {}
