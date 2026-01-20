import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MovieService } from './movie.service';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';
import { MOVIE_PATTERNS, MOVIE_SCENE_PATTERNS } from 'libs/shared';

@Controller()
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @MessagePattern(MOVIE_PATTERNS.CREATE_ONE)
  async createOne(@Payload() createMoviePayload: CreateMovieDto) {
    return this.movieService.createMovie(createMoviePayload);
  }

  @MessagePattern(MOVIE_PATTERNS.FETCH_ALL)
  async fetchAllMovies() {
    return this.movieService.findAllMovies();
  }

  @MessagePattern(MOVIE_PATTERNS.FETCH_BY_ID)
  async fetchMovieById(@Payload() payload: { id: number }) {
    return this.movieService.findMovieById(payload.id);
  }

  @MessagePattern(MOVIE_SCENE_PATTERNS.FETCH_BY_ID)
  async fetchMovieSceneById(@Payload() payload: { id: number }) {
    return this.movieService.findMovieSceneById(payload.id);
  }

  @MessagePattern(MOVIE_SCENE_PATTERNS.FETCH_ALL)
  async fetchAllMovieScenes() {
    return this.movieService.findAllMovieScenes();
  }

  @MessagePattern(MOVIE_SCENE_PATTERNS.CREATE_ONE)
  async createMovieScene(@Payload() createMovieScenePayload: CreateMovieSceneDto) {
    return this.movieService.createMovieScene(createMovieScenePayload);
  }
}
