import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiController } from 'src/shared/decorators';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { FindByIdDto } from 'src/shared/dtos/findById.dto';

@ApiController('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  async create(@Body() createMovieDto: CreateMovieDto) {
    return await this.moviesService.create(createMovieDto);
  }

  @Get()
  async findAll() {
    return await this.moviesService.findAll();
  }

  @Get(':id')
  async findOne(@Param() findByIdDto: FindByIdDto) {
    return await this.moviesService.findOne(findByIdDto.id);
  }
}
