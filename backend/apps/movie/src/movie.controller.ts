import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MovieService } from './movie.service';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

@Controller()
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @MessagePattern('movie.create.one')
  async createOne(@Payload() createMoviePayload: CreateMovieDto) {
    return this.movieService.createMovie(createMoviePayload);
  }

  @MessagePattern('movie.fetch.all')
  async fetchAllMovies() {
    return this.movieService.findAllMovies();
  }

  @MessagePattern('movie.fetch.byId')
  async fetchMovieById(@Payload() payload: { id: number }) {
    return this.movieService.findMovieById(payload.id);
  }

  @MessagePattern('movie-scene.fetch.byId')
  async fetchMovieSceneById(@Payload() payload: { id: number }) {
    return this.movieService.findMovieSceneById(payload.id);
  }

  @MessagePattern('movie-scene.fetch.all')
  async fetchAllMovieScenes() {
    return this.movieService.findAllMovieScenes();
  }

  @MessagePattern('movie-scene.create.one')
  async createMovieScene(@Payload() createMovieScenePayload: CreateMovieSceneDto) {
    return this.movieService.createMovieScene(createMovieScenePayload);
  }
}
