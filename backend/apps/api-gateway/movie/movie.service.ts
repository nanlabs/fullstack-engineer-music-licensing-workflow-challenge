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
import { catchError, lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class MovieService {
  constructor(
    @Inject(forwardRef(() => 'MOVIE_SERVICE'))
    private readonly movieMicroserviceClient: ClientRMQ,
  ) {}

  getHealth(): string {
    return 'Hello World FROM API API Gateway!';
  }

  async create(createMoviePayload: CreateMovieDto) {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send('movie.create.one', createMoviePayload),
    );
    return result;
  }

  async fetch() {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send('movie.fetch.all', {}),
    );
    return result;
  }

  async fetchScenes() {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send('movie-scene.fetch.all', {}),
    );
    return result;
  }

  async createScene(createMovieScenePayload: CreateMovieSceneDto) {
    const result = await lastValueFrom(
      this.movieMicroserviceClient.send('movie-scene.create.one', createMovieScenePayload),
    );
    return result;
  }
}
