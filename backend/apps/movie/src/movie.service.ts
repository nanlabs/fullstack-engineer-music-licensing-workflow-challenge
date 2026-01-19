import { HttpStatus, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { TypeOrmRepositoryService } from 'libs/database/postgres/repository/service/typeorm-repository.service';
import { MovieEntity, MovieSceneEntity } from 'libs/shared';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';

@Injectable()
export class MovieService {
  constructor(
    private readonly typeOrmRepositoryService: TypeOrmRepositoryService,
  ) {}

  async findAllMovies() {
    return this.typeOrmRepositoryService.movieRepository.findAll();
  }

  async findMovieById(id: number) {
    return this.typeOrmRepositoryService.movieRepository.findById(id);
  }

  async createMovie(createMoviePayload: CreateMovieDto) {
    const newMovie = new MovieEntity();
    newMovie.releaseDate = createMoviePayload.releaseDate;
    newMovie.title = createMoviePayload.title;
    newMovie.encodingFormat = createMoviePayload.encodingFormat;

    return this.typeOrmRepositoryService.movieRepository.createOne(newMovie);
  }

  async findAllMovieScenes() {
    return this.typeOrmRepositoryService.movieSceneRepository.findAll(['movie']);
  }

  async findMovieSceneById(id: number) {
    return this.typeOrmRepositoryService.movieSceneRepository.findById(id);
  }

  async createMovieScene(createMovieScenePayload: CreateMovieSceneDto) {
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
