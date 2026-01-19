import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { CreateMovieDto } from '../../../libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from '../../../libs/shared/dto/create-movie-scene.dto';
import { MovieService } from './movie.service';

@Controller('/movies')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get('/health')
  getHealth(): string {
    return this.movieService.getHealth();
  }

  @Get()
  fetch() {
    return this.movieService.fetch();
  }

  @Post()
  async create(@Body() createMoviePayload: CreateMovieDto) {
    return this.movieService.create(createMoviePayload);
  }

  @Get('/scenes')
  fetchScenes() {
    return this.movieService.fetchScenes();
  }

  @Post('/scenes')
  async createScene(@Body() createMovieScenePayload: CreateMovieSceneDto) {
    return this.movieService.createScene(createMovieScenePayload);
  }
}
