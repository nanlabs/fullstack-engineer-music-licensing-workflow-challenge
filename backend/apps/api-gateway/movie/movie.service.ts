import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ClientRMQ, ClientTCP } from '@nestjs/microservices';
import { CreateMovieDto } from 'libs/shared/dto/create-movie.dto';
import { CreateMovieSceneDto } from 'libs/shared/dto/create-movie-scene.dto';
import { INJECTION_TOKENS, MOVIE_PATTERNS, MOVIE_SCENE_PATTERNS } from 'libs/shared';
import { catchError, lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class MovieService {
  constructor(
    @Inject(forwardRef(() => INJECTION_TOKENS.MOVIE_SERVICE))
    private readonly movieMicroserviceClient: ClientRMQ,
  ) {}

  getHealth(): string {
    return 'Hello World FROM API API Gateway!';
  }

  async create(createMoviePayload: CreateMovieDto) {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send(MOVIE_PATTERNS.CREATE_ONE, createMoviePayload),
    );
    return result;
  }

  async fetch() {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send(MOVIE_PATTERNS.FETCH_ALL, {}),
    );
    return result;
  }

  async fetchScenes() {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send(MOVIE_SCENE_PATTERNS.FETCH_ALL, {}),
    );
    return result;
  }

  async createScene(createMovieScenePayload: CreateMovieSceneDto) {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send(MOVIE_SCENE_PATTERNS.CREATE_ONE, createMovieScenePayload),
    );
    return result;
  }
}
