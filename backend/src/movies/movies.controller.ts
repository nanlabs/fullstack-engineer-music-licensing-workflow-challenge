import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiController } from 'src/shared/decorators';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { FindByIdDto } from 'src/shared/dtos/findById.dto';

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
  findOne(@Param() findByIdDto: FindByIdDto) {
    return this.moviesService.findOne(findByIdDto.id);
  }
}
