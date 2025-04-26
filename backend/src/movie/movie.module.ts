import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../entities/movie.entity';
import { MovieService } from './movie.service';
import { MovieController } from './movie.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Movie])],
  providers: [MovieService],
  controllers: [MovieController],
})
export class MovieModule {}
