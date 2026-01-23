import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { CreateMovie } from '../application/create.movie';
import { GetMovies } from '../application/get.movies';
import { UpdateMovie } from '../application/update.movie';
import { GetMovie } from '../application/get.movie';
import { RemoveMovie } from '../application/remove.movie';
import { GetMovieTracks } from '../application/get.movie.tracks';

@Controller('movies')
export class MoviesController {
  constructor(
    private readonly createMovie: CreateMovie,
    private readonly getMovies: GetMovies,
    private readonly updateMovie: UpdateMovie,
    private readonly getMovie: GetMovie,
    private readonly removeMovie: RemoveMovie,
    private readonly getMovieTracks: GetMovieTracks,
  ) {}

  @ApiOperation({ summary: 'Create a new movie' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiBody({ type: CreateMovieDto })
  create(@Body() createMovieDto: CreateMovieDto) {
    return this.createMovie.execute(createMovieDto)
  }

  @ApiOperation({ summary: 'Get all movies' })
  @HttpCode(HttpStatus.OK)
  @Get()
  findAll() {
    return this.getMovies.execute()
  }

  @ApiOperation({ summary: 'Get a movie by ID' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getMovie.execute(id)
  }

  @ApiOperation({ summary: 'Get tracks for a given movie' })
  @HttpCode(HttpStatus.OK)
  @Get(':id/tracks')
  getTracks(@Param('id') id: string) {
    return this.getMovieTracks.execute(id)
  }

  @ApiOperation({ summary: 'Update a movie by ID' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiBody({ type: UpdateMovieDto })
  update(@Param('id') id: string, @Body() updateMovieDto: UpdateMovieDto) {
    return this.updateMovie.execute(id, updateMovieDto)
  }

  @ApiOperation({ summary: 'Delete a movie by ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.removeMovie.execute(id)
  }
}
