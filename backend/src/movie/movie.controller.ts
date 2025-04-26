import { Controller, Get, Post, Body } from '@nestjs/common';
import { MovieService } from './movie.service';
import { Movie } from 'src/entities/movie.entity';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get()
  findAll() {
    return this.movieService.findAll();
  }

  @Post()
  create(@Body() data: Partial<Movie>): Promise<Movie> {
    return this.movieService.create(data);
  }
}
