import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiController } from 'src/decorators';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';

@ApiController('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.moviesService.create(createMovieDto);
  }

  @Get()
  findAll() {
    return this.moviesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }
}
