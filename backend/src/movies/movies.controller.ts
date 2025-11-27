import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { CreateMovieDto, UpdateMovieDto } from './dto/movie.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new movie' })
  @ApiResponse({ status: 201, description: 'The movie has been successfully created.' })
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.moviesService.create(createMovieDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all movies' })
  @ApiResponse({ status: 200, description: 'Return all movies.' })
  findAll() {
    return this.moviesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a movie by ID' })
  @ApiResponse({ status: 200, description: 'Return the movie.' })
  @ApiResponse({ status: 404, description: 'Movie not found.' })
  findOne(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a movie' })
  @ApiResponse({ status: 200, description: 'The movie has been successfully updated.' })
  update(@Param('id') id: string, @Body() updateMovieDto: UpdateMovieDto) {
    return this.moviesService.update(id, updateMovieDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a movie' })
  @ApiResponse({ status: 200, description: 'The movie has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.moviesService.remove(id);
  }
}
