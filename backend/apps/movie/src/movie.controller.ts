import { Controller, forwardRef, Get, Inject, HttpStatus } from '@nestjs/common';
import {
  ClientRMQ,
  ClientTCP,
  EventPattern,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { MovieEntity, MovieSceneEntity } from 'libs/shared';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

@Controller()
export class MovieController {
  constructor(
    @Inject('api-gateway-host')
    private readonly apiGatewayMicroserviceClient: ClientTCP,
    @Inject(forwardRef(() => 'MOVIE_SERVICE'))
    private readonly movieServiceClient: ClientRMQ,
    private typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  @MessagePattern('movie.create.one')
  async createOne(createMoviePayload: CreateMovieDto) {
    const newMovie = new MovieEntity();
    newMovie.releaseDate = createMoviePayload.releaseDate;
    newMovie.title = createMoviePayload.title;
    newMovie.encodingFormat = createMoviePayload.encodingFormat;

    return this.typeOrmRepositoryService.movieRepository.createOne(newMovie);
  }

  @MessagePattern('movie.fetch.all')
  async fetchAllMovies() {
    return this.typeOrmRepositoryService.movieRepository.findAll();
  }

  @MessagePattern('movie.fetch.byId')
  async fetchMovieById(@Payload() payload: { id: number }) {
    return this.typeOrmRepositoryService.movieRepository.findById(payload.id);
  }

  @MessagePattern('movie-scene.fetch.byId')
  async fetchMovieSceneById(@Payload() payload: { id: number }) {
    return this.typeOrmRepositoryService.movieSceneRepository.findById(payload.id);
  }

  @MessagePattern('movie-scene.fetch.all')
  async fetchAllMovieScenes() {
    return this.typeOrmRepositoryService.movieSceneRepository.findAll(['movie']);
  }

  @MessagePattern('movie-scene.create.one')
  async createMovieScene(@Payload() createMovieScenePayload: CreateMovieSceneDto) {
    // Validate that the movie exists
    const movie = await this.typeOrmRepositoryService.movieRepository.findById(
      createMovieScenePayload.movieId,
    );

    if (!movie) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Movie with id ${createMovieScenePayload.movieId} not found`,
      });
    }

    const newMovieScene = new MovieSceneEntity();
    newMovieScene.name = createMovieScenePayload.name || '';
    newMovieScene.movie = movie;

    return this.typeOrmRepositoryService.movieSceneRepository.createOne(newMovieScene);
  }
}
