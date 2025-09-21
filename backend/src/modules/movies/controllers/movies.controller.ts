import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateMovieDto } from '../dto/create-movie.dto';
import { UpdateMovieDto } from '../dto/update-movie.dto';
import { Movie } from '../entities/movie.entity';
import { MoviesService } from '../services/movies.service';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new movie' })
  @ApiResponse({ status: 201, description: 'Movie created successfully', type: Movie })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createMovieDto: CreateMovieDto): Promise<Movie> {
    return await this.moviesService.create(createMovieDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all movies' })
  @ApiResponse({ status: 200, description: 'Movies retrieved successfully', type: [Movie] })
  async findAll(): Promise<Movie[]> {
    return await this.moviesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a movie by ID' })
  @ApiParam({ name: 'id', description: 'Movie ID' })
  @ApiResponse({ status: 200, description: 'Movie retrieved successfully', type: Movie })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Movie> {
    return await this.moviesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a movie' })
  @ApiParam({ name: 'id', description: 'Movie ID' })
  @ApiResponse({ status: 200, description: 'Movie updated successfully', type: Movie })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMovieDto: UpdateMovieDto,
  ): Promise<Movie> {
    return await this.moviesService.update(id, updateMovieDto);
  }
}
