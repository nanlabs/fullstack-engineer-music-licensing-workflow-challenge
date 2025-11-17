import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { FindAllMoviesDto } from './dto/findAll-movies.dto';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new movie' })
  @ApiBody({ type: CreateMovieDto })
  @ApiResponse({
    status: 201,
    description: 'Movie created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.moviesService.create(createMovieDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all movies with pagination and search' })
  @ApiResponse({
    status: 200,
    description: 'List of movies retrieved successfully',
  })
  findAll(@Query() findAllMoviesDto: FindAllMoviesDto) {
    return this.moviesService.findAll(findAllMoviesDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a movie by ID' })
  @ApiParam({
    name: 'id',
    description: 'Movie ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Movie retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  findOne(@Param('id') id: string) {
    return this.moviesService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a movie by ID' })
  @ApiParam({
    name: 'id',
    description: 'Movie ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateMovieDto })
  @ApiResponse({
    status: 200,
    description: 'Movie updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  update(@Param('id') id: string, @Body() updateMovieDto: UpdateMovieDto) {
    return this.moviesService.update(+id, updateMovieDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a movie by ID (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Movie ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Movie deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  remove(@Param('id') id: string) {
    return this.moviesService.remove(+id);
  }
}
